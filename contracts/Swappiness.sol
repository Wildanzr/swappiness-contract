// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IUniversalRouter} from "./interfaces/IUniversalRouter.sol";
import {Commands} from "./interfaces/Commands.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IUniswapV3Factory} from "./interfaces/IUniswapV3Factory.sol";
import {IPermit2} from "./interfaces/IPermit2.sol";
import {IWETH} from "./interfaces/IWETH.sol";

// V3
// IDRX/USDC		0.01%
// USDC/USDT		0.01%
// ETH/USDT		  0.05%
// EURC/USDC		0.30%
// ETH/EURC		  0.30%
// DAI/USDC		  0.01%
// ETH/DAI			0.05%
// ETH/USDC		  0.05%

contract Swappiness {
    address public owner;
    IUniversalRouter public immutable router;
    IPermit2 public immutable permit2;
    IWETH public immutable weth;

    // Add these constants at the top of your contract
    address constant USDC_ADDRESS = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913; // Base USDC
    address constant USDT_ADDRESS = 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2; // Base USDT
    address constant DAI_ADDRESS = 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb; // Base DAI
    address constant IDRX_ADDRESS = 0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22; // Base IDRX
    address constant EURC_ADDRESS = 0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42; // Base EURC

    event Error(string message);
    event SwapCompleted(address tokenIn, address tokenOut, uint256 amountOut, uint256 amountInUsed);
    event DispersedToStablecoins(address tokenIn, uint256 totalAmountIn);

    constructor() {
        owner = msg.sender;
        router = IUniversalRouter(0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD);
        permit2 = IPermit2(0x000000000022D473030F116dDEE9F6B43aC78BA3);
        weth = IWETH(0x4200000000000000000000000000000000000006);
        permit2.approve(address(weth), address(router), type(uint160).max, type(uint48).max);
        weth.approve(address(permit2), type(uint256).max);
    }

    /**
     * @notice Swaps an exact output amount of any token using either ETH or ERC20 as input
     * @param tokenIn Address of the input token (use address(0) for ETH)
     * @param tokenOut Address of the output token
     * @param amountOut Exact amount of output tokens to receive
     * @param amountInMaximum Maximum amount of input tokens to spend (or msg.value for ETH)
     * @param poolFee The fee tier of the pool, in hundredths of a bip (e.g. 500 = 0.05%)
     * @return amountIn The actual amount of input tokens used
     */
    function swapExactOutput(
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        uint256 amountInMaximum,
        uint24 poolFee
    ) external payable returns (uint256 amountIn) {
        if (amountOut == 0) revert("AmountOut must be greater than zero");

        // Determine if tokenIn is ETH (address(0))
        bool isEthInput = tokenIn == address(0);

        // Set tokenIn to weth address for path encoding if input is ETH
        if (isEthInput) {
            // Check that ETH was sent
            if (msg.value == 0) revert("No ETH sent");

            // For ETH input, amountInMaximum must be msg.value
            amountInMaximum = msg.value;
            tokenIn = address(weth);
        } else {
            // For ERC20 inputs
            if (amountInMaximum == 0) revert("AmountInMaximum must be greater than zero");

            // Transfer ERC20 tokens from sender to this contract
            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountInMaximum);

            // Approve tokens for Permit2
            IERC20(tokenIn).approve(address(permit2), amountInMaximum);
            permit2.approve(tokenIn, address(router), uint160(amountInMaximum), uint48(block.timestamp + 15 * 60));
        }

        // Encode the path for swapping
        bytes memory path = abi.encodePacked(tokenOut, poolFee, tokenIn);

        // Prepare the commands and inputs based on whether we're using ETH or ERC20
        bytes memory commands;
        bytes[] memory inputs;

        if (isEthInput) {
            // For ETH: wrap ETH then do exact output swap
            commands = abi.encodePacked(bytes1(uint8(Commands.WRAP_ETH)), bytes1(uint8(Commands.V3_SWAP_EXACT_OUT)));

            inputs = new bytes[](2);
            inputs[0] = abi.encode(address(this), amountInMaximum);
            inputs[1] = abi.encode(msg.sender, amountOut, amountInMaximum, path, true);
        } else {
            // For ERC20: just do exact output swap
            commands = abi.encodePacked(bytes1(uint8(Commands.V3_SWAP_EXACT_OUT)));

            inputs = new bytes[](1);
            inputs[0] = abi.encode(
                msg.sender, // recipient
                amountOut, // exact amount out
                amountInMaximum, // max amount in
                path, // token path
                true // use permit2
            );
        }

        // Set deadline to 15 minutes from now
        uint256 deadline = block.timestamp + 15 * 60;

        // Execute the swap
        try router.execute{value: isEthInput ? amountInMaximum : 0}(commands, inputs, deadline) {
            emit SwapCompleted(tokenIn, tokenOut, amountOut, amountInMaximum);
            amountIn = amountInMaximum; // This is an approximation; actual amount used may be less
        } catch (bytes memory reason) {
            emit Error(string(reason));
        }

        // Return any remaining ETH to sender
        if (isEthInput) {
            uint256 balanceAfter = address(this).balance;
            if (balanceAfter > 0) {
                payable(msg.sender).transfer(balanceAfter);
            }
        }

        return amountIn;
    }

    function simpleMultiHopSwapExactOutput(uint256 amountOut) external payable {
        if (msg.value == 0) revert("No ETH sent");
        if (amountOut == 0) revert("AmountOut must be greater than zero");

        bytes memory commands =
            abi.encodePacked(bytes1(uint8(Commands.WRAP_ETH)), bytes1(uint8(Commands.V3_SWAP_EXACT_OUT)));

        uint256 amount = msg.value;
        bytes memory path = abi.encodePacked(DAI_ADDRESS, uint24(100), USDC_ADDRESS, uint24(500), address(weth));

        bytes[] memory inputs = new bytes[](2);
        inputs[0] = abi.encode(address(this), amount);
        inputs[1] = abi.encode(msg.sender, amountOut, msg.value, path, true);

        uint256 deadline = block.timestamp + 15 * 60; // 15 minutes

        try router.execute{value: amount}(commands, inputs, deadline) {
            emit SwapCompleted(address(weth), DAI_ADDRESS, amountOut, msg.value);
        } catch (bytes memory reason) {
            emit Error(string(reason));
        }

        uint256 balanceAfter = address(this).balance;
        if (balanceAfter > 0) {
            payable(msg.sender).transfer(balanceAfter);
        }
    }

    function disperseToStablecoins(
        address tokenIn,
        address[] calldata recipients,
        address[] calldata tokenOut,
        uint256[] calldata amountOut,
        uint256[] calldata amountInMax,
        bytes[] calldata paths
    ) external payable {
        // Validate all inputs upfront
        uint256 swapCount = recipients.length;
        if (swapCount == 0) revert("No recipients specified");
        if (
            tokenOut.length != swapCount || amountOut.length != swapCount || amountInMax.length != swapCount
                || paths.length != swapCount
        ) {
            revert("Array length mismatch");
        }

        bool isEthInput = tokenIn == address(0);
        uint256 totalAmountInMax = 0;

        // Validate amounts and calculate total required
        for (uint256 i = 0; i < swapCount; i++) {
            if (amountOut[i] == 0) revert("AmountOut must be greater than zero");
            if (amountInMax[i] == 0) revert("AmountInMax must be greater than zero");
            totalAmountInMax += amountInMax[i];
        }

        // ETH input validation
        if (isEthInput) {
            if (msg.value == 0) revert("No ETH sent");
            if (totalAmountInMax > msg.value) revert("Total amountInMax exceeds msg.value");
            tokenIn = address(weth); // Set tokenIn to weth for paths
        } else {
            // ERC20 input validation & transfer
            IERC20(tokenIn).transferFrom(msg.sender, address(this), totalAmountInMax);
            IERC20(tokenIn).approve(address(permit2), totalAmountInMax);
            permit2.approve(tokenIn, address(router), uint160(totalAmountInMax), uint48(block.timestamp + 15 * 60));
        }

        uint256 deadline = block.timestamp + 15 * 60; // 15 minutes
        uint256 totalUsed = 0;

        // Process each swap
        for (uint256 i = 0; i < swapCount; i++) {
            bytes memory commands;
            bytes[] memory inputs;
            uint256 ethValue = 0;

            if (isEthInput) {
                commands = abi.encodePacked(bytes1(uint8(Commands.WRAP_ETH)), bytes1(uint8(Commands.V3_SWAP_EXACT_OUT)));
                inputs = new bytes[](2);
                inputs[0] = abi.encode(address(this), amountInMax[i]);
                inputs[1] = abi.encode(recipients[i], amountOut[i], amountInMax[i], paths[i], true);
                ethValue = amountInMax[i];
            } else {
                commands = abi.encodePacked(bytes1(uint8(Commands.V3_SWAP_EXACT_OUT)));
                inputs = new bytes[](1);
                inputs[0] = abi.encode(recipients[i], amountOut[i], amountInMax[i], paths[i], true);
            }

            try router.execute{value: ethValue}(commands, inputs, deadline) {
                emit SwapCompleted(isEthInput ? address(0) : tokenIn, tokenOut[i], amountOut[i], amountInMax[i]);
                totalUsed += amountInMax[i];
            } catch (bytes memory reason) {
                emit Error(string(reason));
            }
        }

        // Return any remaining ETH to sender
        if (isEthInput) {
            uint256 balanceAfter = address(this).balance;
            if (balanceAfter > 0) {
                payable(msg.sender).transfer(balanceAfter);
            }
        }

        emit DispersedToStablecoins(isEthInput ? address(0) : tokenIn, totalUsed);
    }
}
