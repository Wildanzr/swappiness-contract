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

    /**
     * Helper function to create the correct swap path
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @return path The encoded swap path
     */
    function _createSwapPath(address tokenIn, address tokenOut) private view returns (bytes memory) {
        // Direct paths from ETH/WETH
        if (tokenIn == address(0) || tokenIn == address(weth)) {
            if (tokenOut == USDC_ADDRESS) {
                return abi.encodePacked(USDC_ADDRESS, uint24(500), address(weth));
            } else if (tokenOut == DAI_ADDRESS) {
                return abi.encodePacked(DAI_ADDRESS, uint24(500), address(weth));
            } else if (tokenOut == EURC_ADDRESS) {
                return abi.encodePacked(EURC_ADDRESS, uint24(3000), address(weth));
            } else if (tokenOut == IDRX_ADDRESS) {
                // Multi-hop: ETH -> USDC -> IDRX
                return abi.encodePacked(IDRX_ADDRESS, uint24(100), USDC_ADDRESS, uint24(500), address(weth));
            } else if (tokenOut == USDT_ADDRESS) {
                return abi.encodePacked(USDT_ADDRESS, uint24(500), address(weth));
            }
        }
        // Direct paths from USDC
        else if (tokenIn == USDC_ADDRESS) {
            if (tokenOut == DAI_ADDRESS) {
                return abi.encodePacked(DAI_ADDRESS, uint24(100), USDC_ADDRESS);
            } else if (tokenOut == IDRX_ADDRESS) {
                return abi.encodePacked(IDRX_ADDRESS, uint24(100), USDC_ADDRESS);
            } else if (tokenOut == EURC_ADDRESS) {
                return abi.encodePacked(EURC_ADDRESS, uint24(3000), USDC_ADDRESS);
            } else if (tokenOut == USDT_ADDRESS) {
                return abi.encodePacked(USDT_ADDRESS, uint24(100), USDC_ADDRESS);
            } else if (tokenOut == address(weth)) {
                return abi.encodePacked(address(weth), uint24(500), USDC_ADDRESS);
            }
        }
        // For other token inputs, route via ETH or USDC
        else {
            address intermediateToken;
            uint24 fee1;
            uint24 fee2;

            // Determine best intermediate token and fees
            (intermediateToken, fee1, fee2) = _getBestRoute(tokenIn, tokenOut);

            // Build multi-hop path
            return abi.encodePacked(tokenOut, fee2, intermediateToken, fee1, tokenIn);
        }

        // Default path through WETH if no specific path found
        return abi.encodePacked(tokenOut, uint24(500), address(weth), uint24(500), tokenIn);
    }

    /**
     * Helper function to determine the best route and fees
     */
    function _getBestRoute(address tokenIn, address tokenOut)
        private
        view
        returns (address intermediateToken, uint24 fee1, uint24 fee2)
    {
        // Default route through ETH/WETH
        intermediateToken = address(weth);
        fee1 = 500; // Default fee
        fee2 = 500; // Default fee

        // Determine best intermediate token and fees
        if (tokenIn == DAI_ADDRESS) {
            if (tokenOut == USDC_ADDRESS || tokenOut == IDRX_ADDRESS || tokenOut == USDT_ADDRESS) {
                // DAI -> USDC -> Other
                intermediateToken = USDC_ADDRESS;
                fee1 = 100; // DAI/USDC fee
            }
        } else if (tokenIn == EURC_ADDRESS && tokenOut == USDC_ADDRESS) {
            fee1 = 3000; // EURC/USDC fee
        } else if (
            tokenIn == IDRX_ADDRESS && (tokenOut == USDC_ADDRESS || tokenOut == DAI_ADDRESS || tokenOut == USDT_ADDRESS)
        ) {
            intermediateToken = USDC_ADDRESS;
            fee1 = 100; // IDRX/USDC fee
        }

        // Set fee2 based on intermediate token and destination
        if (intermediateToken == USDC_ADDRESS) {
            if (tokenOut == DAI_ADDRESS || tokenOut == IDRX_ADDRESS || tokenOut == USDT_ADDRESS) {
                fee2 = 100;
            } else if (tokenOut == EURC_ADDRESS) {
                fee2 = 3000;
            } else if (tokenOut == address(weth)) {
                fee2 = 500;
            }
        } else {
            // If intermediate is ETH/WETH
            if (tokenOut == USDC_ADDRESS || tokenOut == DAI_ADDRESS || tokenOut == USDT_ADDRESS) {
                fee2 = 500;
            } else if (tokenOut == EURC_ADDRESS) {
                fee2 = 3000;
            }
        }

        return (intermediateToken, fee1, fee2);
    }

    /**
     * @dev Disperses a single token to multiple recipients as different stablecoins
     * @param tokenIn Address of the input token (use address(0) for ETH)
     * @param recipients Array of recipient addresses
     * @param tokenOut Array of output token addresses (stablecoins to send)
     * @param amountOut Array of output amounts
     * @param amountInMax Array of maximum input amounts willing to spend
     */
    function disperseToStablecoins(
        address tokenIn,
        address[] calldata recipients,
        address[] calldata tokenOut,
        uint256[] calldata amountOut,
        uint256[] calldata amountInMax
    ) external payable {
        // Validate input parameters
        uint256 numSwaps = tokenOut.length;
        require(numSwaps > 0, "No swaps specified");
        require(numSwaps == amountOut.length, "Length mismatch: tokenOut/amountOut");
        require(numSwaps == amountInMax.length, "Length mismatch: tokenOut/amountInMax");
        require(numSwaps == recipients.length, "Length mismatch: tokenOut/recipients");

        // Handle ETH as input token
        bool isETHInput = tokenIn == address(0);

        _handleTokenTransfer(tokenIn, numSwaps, amountInMax, isETHInput);

        // Process swaps
        (bytes memory finalCommands, bytes[] memory finalInputs) =
            _prepareSwaps(tokenIn, recipients, tokenOut, amountOut, amountInMax, numSwaps, isETHInput);

        uint256 deadline = block.timestamp + 15 * 60; // 15 minutes

        // Execute all swaps via the router
        try router.execute{value: isETHInput ? msg.value : 0}(finalCommands, finalInputs, deadline) {
            emit DispersedToStablecoins(
                isETHInput ? address(weth) : tokenIn, isETHInput ? msg.value : _calculateTotalAmountIn(amountInMax)
            );
        } catch (bytes memory reason) {
            emit Error(string(reason));
        }

        _returnUnusedFunds(tokenIn, isETHInput);
    }

    /**
     * Helper to calculate total amount in
     */
    function _calculateTotalAmountIn(uint256[] calldata amountInMax) private pure returns (uint256 totalAmountIn) {
        for (uint256 i = 0; i < amountInMax.length; i++) {
            totalAmountIn += amountInMax[i];
        }
        return totalAmountIn;
    }

    /**
     * Helper to handle token transfers before swaps
     */
    function _handleTokenTransfer(address tokenIn, uint256, uint256[] calldata amountInMax, bool isETHInput) private {
        if (!isETHInput) {
            // For ERC20 tokens, transfer them to this contract first
            uint256 totalAmountIn = _calculateTotalAmountIn(amountInMax);

            // Transfer tokens to this contract
            IERC20(tokenIn).transferFrom(msg.sender, address(this), totalAmountIn);

            // Approve router to use these tokens
            IERC20(tokenIn).approve(address(router), totalAmountIn);
        }
    }

    /**
     * Helper to prepare swap commands and inputs
     */
    function _prepareSwaps(
        address tokenIn,
        address[] calldata recipients,
        address[] calldata tokenOut,
        uint256[] calldata amountOut,
        uint256[] calldata amountInMax,
        uint256 numSwaps,
        bool isETHInput
    ) private returns (bytes memory finalCommands, bytes[] memory finalInputs) {
        // Prepare dynamic arrays for commands and inputs
        bytes memory commands = new bytes(numSwaps * 2); // Each swap needs up to 2 commands (wrap + swap)
        bytes[] memory inputs = new bytes[](numSwaps * 2);

        uint256 commandIdx = 0;
        uint256 inputIdx = 0;

        // If using ETH as input, first command is to wrap it
        if (isETHInput) {
            commands[commandIdx++] = bytes1(uint8(Commands.WRAP_ETH));
            inputs[inputIdx++] = abi.encode(address(this), msg.value);
        }

        // Process each swap
        for (uint256 i = 0; i < numSwaps; i++) {
            address currentTokenOut = tokenOut[i];
            uint256 currentAmountOut = amountOut[i];
            address recipient = recipients[i];

            // Skip if token out is same as token in (just transfer directly)
            if (currentTokenOut == tokenIn) {
                if (isETHInput) {
                    payable(recipient).transfer(currentAmountOut);
                } else {
                    IERC20(tokenIn).transfer(recipient, currentAmountOut);
                }
                continue;
            }

            // Determine optimal swap path based on token pair
            bytes memory path = _createSwapPath(tokenIn, currentTokenOut);

            // Add the swap command
            commands[commandIdx++] = bytes1(uint8(Commands.V3_SWAP_EXACT_OUT));
            inputs[inputIdx++] = abi.encode(recipient, currentAmountOut, amountInMax[i], path, isETHInput);
        }

        // Trim commands and inputs arrays to actual size
        finalCommands = new bytes(commandIdx);
        for (uint256 i = 0; i < commandIdx; i++) {
            finalCommands[i] = commands[i];
        }

        finalInputs = new bytes[](inputIdx);
        for (uint256 i = 0; i < inputIdx; i++) {
            finalInputs[i] = inputs[i];
        }

        return (finalCommands, finalInputs);
    }

    /**
     * Helper to return any unused funds
     */
    function _returnUnusedFunds(address tokenIn, bool isETHInput) private {
        // Return any unused ETH to the sender
        uint256 ethBalance = address(this).balance;
        if (ethBalance > 0) {
            payable(msg.sender).transfer(ethBalance);
        }

        // Return any unused input tokens
        if (!isETHInput) {
            uint256 remainingTokens = IERC20(tokenIn).balanceOf(address(this));
            if (remainingTokens > 0) {
                IERC20(tokenIn).transfer(msg.sender, remainingTokens);
            }
        }
    }
}
