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

    function simpleSwapExactOutput(uint256 amountOut) external payable {
        if (msg.value == 0) revert("No ETH sent");
        if (amountOut == 0) revert("AmountOut must be greater than zero");

        bytes memory commands =
            abi.encodePacked(bytes1(uint8(Commands.WRAP_ETH)), bytes1(uint8(Commands.V3_SWAP_EXACT_OUT)));

        uint256 amount = msg.value;
        bytes memory path = abi.encodePacked(USDC_ADDRESS, uint24(500), address(weth));

        bytes[] memory inputs = new bytes[](2);
        inputs[0] = abi.encode(address(this), amount);
        inputs[1] = abi.encode(msg.sender, amountOut, msg.value, path, true);

        uint256 deadline = block.timestamp + 15 * 60; // 15 minutes

        try router.execute{value: amount}(commands, inputs, deadline) {
            emit SwapCompleted(address(weth), USDC_ADDRESS, amountOut, msg.value);
        } catch (bytes memory reason) {
            emit Error(string(reason));
        }

        uint256 balanceAfter = address(this).balance;
        if (balanceAfter > 0) {
            payable(msg.sender).transfer(balanceAfter);
        }
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
}
