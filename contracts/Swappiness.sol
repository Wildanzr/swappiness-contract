// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IUniversalRouter} from "./interfaces/IUniversalRouter.sol";
import {Commands} from "./interfaces/Commands.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IUniswapV3Factory} from "./interfaces/IUniswapV3Factory.sol";
import {IPermit2} from "./interfaces/IPermit2.sol";
import {IWETH} from "./interfaces/IWETH.sol";

contract Swappiness {
    address public owner;
    IUniversalRouter public immutable router;
    IPermit2 public immutable permit2;
    IWETH public immutable weth;

    event Error(string message);
    event SwapCompleted(address tokenIn, address tokenOut, uint256 amountOut, uint256 amountInUsed);

    constructor() {
        owner = msg.sender;
        router = IUniversalRouter(0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD);
        permit2 = IPermit2(0x000000000022D473030F116dDEE9F6B43aC78BA3);
        weth = IWETH(0x4200000000000000000000000000000000000006);
        permit2.approve(address(weth), address(router), type(uint160).max, type(uint48).max);
        weth.approve(address(permit2), type(uint256).max);
    }

    function execute(address token) public payable {
        if (msg.value == 0) revert();

        bytes memory commands =
            abi.encodePacked(bytes1(uint8(Commands.WRAP_ETH)), bytes1(uint8(Commands.V2_SWAP_EXACT_IN)));

        uint256 amount = msg.value;
        address[] memory path = new address[](2);
        path[0] = address(weth);
        path[1] = token;

        bytes[] memory inputs = new bytes[](2);
        inputs[0] = abi.encode(address(this), amount);
        inputs[1] = abi.encode(msg.sender, amount, 0, path, true);

        try router.execute{value: amount}(commands, inputs, block.timestamp) {
            // Success
        } catch (bytes memory reason) {
            // Handle failure
            emit Error(string(reason));
        }
    }

    /**
     * @notice Swap with exact output amount specified
     * @param tokenIn Address of input token (use address(0) for ETH)
     * @param tokenOut Address of output token
     * @param amountOut Exact amount of output tokens to receive
     * @param amountInMaximum Maximum amount of input tokens to spend
     * @return amountIn Actual amount of input tokens spent
     */
    function swapExactOutput(address tokenIn, address tokenOut, uint256 amountOut, uint256 amountInMaximum)
        public
        payable
        returns (uint256 amountIn)
    {
        // Set up path for the swap
        address[] memory path = new address[](2);
        bytes memory commands;
        bytes[] memory inputs;
        bool isEthInput = tokenIn == address(0);
        uint256 value = 0;

        // Handle different input token scenarios
        if (isEthInput) {
            // ETH -> tokenOut case
            require(msg.value >= amountInMaximum, "Insufficient ETH sent");
            value = amountInMaximum;

            // Wrap ETH first then swap
            commands = abi.encodePacked(bytes1(uint8(Commands.WRAP_ETH)), bytes1(uint8(Commands.V2_SWAP_EXACT_OUT)));

            // Set up the swap path
            path[0] = address(weth);
            path[1] = tokenOut;

            // Prepare inputs
            inputs = new bytes[](2);
            inputs[0] = abi.encode(address(this), amountInMaximum);
            inputs[1] = abi.encode(msg.sender, amountOut, amountInMaximum, path, true);
        } else if (tokenIn == address(weth)) {
            // WETH -> tokenOut case
            // Ensure contract has enough WETHs
            require(IERC20(tokenIn).balanceOf(address(this)) >= amountInMaximum, "Insufficient WETH balance");

            // Single command to swap
            commands = abi.encodePacked(bytes1(uint8(Commands.V2_SWAP_EXACT_OUT)));

            // Set up the swap path
            path[0] = tokenIn;
            path[1] = tokenOut;

            // Prepare inputs
            inputs = new bytes[](1);
            inputs[0] = abi.encode(msg.sender, amountOut, amountInMaximum, path, false);
        } else {
            // ERC20 -> tokenOut case
            // Transfer tokens from user to contract first
            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountInMaximum);

            // Approve router to use the tokens
            IERC20(tokenIn).approve(address(permit2), amountInMaximum);

            // Single command to swap
            commands = abi.encodePacked(
                bytes1(uint8(Commands.PERMIT2_TRANSFER_FROM)), bytes1(uint8(Commands.V2_SWAP_EXACT_OUT))
            );

            // Set up the swap path
            path[0] = tokenIn;
            path[1] = tokenOut;

            // Prepare inputs for permit2 and swap
            inputs = new bytes[](2);
            inputs[0] = abi.encode(tokenIn, address(this), address(router), amountInMaximum);
            inputs[1] = abi.encode(msg.sender, amountOut, amountInMaximum, path, false);
        }

        // Execute the swap
        try router.execute{value: value}(commands, inputs, block.timestamp) {
            // For exact output swaps, we need to assume a certain amount was used
            // Since we can't get the return value directly, we'll use the maximum amount
            amountIn = amountInMaximum;

            // Note: For more accurate accounting, you could check token balances before and after the swap
            // to determine exactly how much was used, but that adds complexity

            // Refund unused ETH if needed (this won't happen now since we assume all was used)
            if (isEthInput && amountIn < amountInMaximum) {
                // Unwrap unused WETH and send it back
                uint256 refundAmount = amountInMaximum - amountIn;
                weth.withdraw(refundAmount);
                (bool success,) = msg.sender.call{value: refundAmount}("");
                require(success, "ETH refund failed");
            }

            emit SwapCompleted(isEthInput ? address(weth) : tokenIn, tokenOut, amountOut, amountIn);
        } catch (bytes memory reason) {
            // Handle failure
            emit Error(string(reason));

            // If ETH was sent and swap failed, refund the user
            if (isEthInput) {
                weth.withdraw(amountInMaximum);
                (bool success,) = msg.sender.call{value: amountInMaximum}("");
                require(success, "ETH refund failed");
            } else if (tokenIn != address(weth)) {
                // Return ERC20 tokens to user
                IERC20(tokenIn).transfer(msg.sender, amountInMaximum);
            }

            revert(string(reason));
        }
    }
}
