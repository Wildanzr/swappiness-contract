// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.20;
pragma abicoder v2;

contract PaymentDisburser {}

// import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
// import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
// import "../interface/WETH.sol";

// /**
//  * @title PaymentDisburser
//  * @notice Disburses ETH payments to multiple recipients in their local stablecoins
//  * in a single transaction using Uniswap V3 for swaps
//  */
// contract PaymentDisburser {
//     // Router for Uniswap V3
//     ISwapRouter public constant swapRouter =
//         ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    
//     // WETH on Ethereum mainnet
//     address public constant WETH9 = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    
//     // Common stablecoins (use actual contract addresses in production)
//     address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
//     address public constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    
//     // Default fee tier (0.3%)
//     uint24 public constant DEFAULT_FEE = 3000;
    
//     // Owner of the contract
//     address public owner;
    
//     // Payment types
//     enum PaymentType { Direct, MultiHop }
    
//     // Payment path structure for multi-hop swaps
//     struct SwapPath {
//         address[] tokens;    // Array of tokens in the path
//         uint24[] fees;       // Array of fees for each hop
//     }
    
//     event PaymentsProcessed(uint totalEthUsed);
//     event PaymentSent(address recipient, address tokenOut, uint ethAmount, uint tokenAmount);
//     event FundsRecovered(address token, uint amount);
    
//     constructor() {
//         owner = msg.sender;
//     }
    
//     /**
//      * @notice Disburse ETH to multiple recipients in their preferred stablecoins
//      * @param recipients Array of addresses to receive payments
//      * @param tokens Array of stablecoins to pay each recipient (final token in case of multi-hop)
//      * @param ethAmounts Array of ETH amounts to convert for each recipient
//      * @param paymentTypes Array indicating if each payment is direct or multi-hop
//      * @param paths Array of SwapPath structs (empty for direct payments)
//      */
//     function batchDisbursement(
//         address[] calldata recipients,
//         address[] calldata tokens,
//         uint[] calldata ethAmounts,
//         PaymentType[] calldata paymentTypes,
//         SwapPath[] calldata paths
//     ) external payable {
//         // Validation
//         require(recipients.length == tokens.length && 
//                 tokens.length == ethAmounts.length &&
//                 ethAmounts.length == paymentTypes.length, 
//                 "Arrays must have equal length");
        
//         uint totalEthNeeded = 0;
//         for (uint i = 0; i < ethAmounts.length; i++) {
//             totalEthNeeded += ethAmounts[i];
//         }
        
//         require(msg.value >= totalEthNeeded, "Insufficient ETH sent");
        
//         // Wrap ETH to WETH
//         IWETH(WETH9).deposit{value: totalEthNeeded}();
        
//         // Process each payment
//         for (uint i = 0; i < recipients.length; i++) {
//             if (paymentTypes[i] == PaymentType.Direct) {
//                 processPayment(recipients[i], tokens[i], ethAmounts[i]);
//             } else {
//                 require(i < paths.length, "Missing path for multi-hop payment");
//                 processMultiHopPayment(recipients[i], tokens[i], ethAmounts[i], paths[i]);
//             }
//         }
        
//         // Return any excess ETH
//         if (msg.value > totalEthNeeded) {
//             (bool success, ) = msg.sender.call{value: msg.value - totalEthNeeded}("");
//             require(success, "ETH refund failed");
//         }
        
//         emit PaymentsProcessed(totalEthNeeded);
//     }
    
//     /**
//      * @notice Process a single payment: swap ETH for stablecoin and send to recipient
//      * @param recipient Address to receive payment
//      * @param token Stablecoin address to send
//      * @param ethAmount Amount of ETH to swap
//      */
//     function processPayment(
//         address recipient,
//         address token,
//         uint ethAmount
//     ) internal {
//         require(recipient != address(0), "Invalid recipient");
//         require(token != address(0), "Invalid token");
//         require(ethAmount > 0, "Amount must be greater than 0");
        
//         // Approve router to spend WETH
//         TransferHelper.safeApprove(WETH9, address(swapRouter), ethAmount);
        
//         // Set up swap parameters
//         ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
//             tokenIn: WETH9,
//             tokenOut: token,
//             fee: DEFAULT_FEE,
//             recipient: recipient, // Send directly to recipient
//             deadline: block.timestamp,
//             amountIn: ethAmount,
//             amountOutMinimum: 0, // In production, use an oracle for minimum amount
//             sqrtPriceLimitX96: 0
//         });
        
//         // Execute swap and send tokens directly to recipient
//         uint amountOut = swapRouter.exactInputSingle(params);
        
//         emit PaymentSent(recipient, token, ethAmount, amountOut);
//     }
    
//     /**
//      * @notice Process a multi-hop payment: swap ETH through multiple pools and send to recipient
//      * @param recipient Address to receive payment
//      * @param finalToken Final token to send (last in the path)
//      * @param ethAmount Amount of ETH to swap
//      * @param path Swap path containing tokens and fees
//      */
//     function processMultiHopPayment(
//         address recipient,
//         address finalToken,
//         uint ethAmount,
//         SwapPath memory path
//     ) internal {
//         require(recipient != address(0), "Invalid recipient");
//         require(finalToken != address(0), "Invalid token");
//         require(ethAmount > 0, "Amount must be greater than 0");
//         require(path.tokens.length >= 2, "Path must have at least 2 tokens");
//         require(path.fees.length == path.tokens.length - 1, "Incorrect fees length");
//         require(path.tokens[0] == WETH9, "Path must start with WETH");
//         require(path.tokens[path.tokens.length - 1] == finalToken, "Path must end with finalToken");
        
//         // Approve router to spend WETH
//         TransferHelper.safeApprove(WETH9, address(swapRouter), ethAmount);
        
//         // Encode the path for multi-hop swap
//         bytes memory encodedPath = encodePathForExactInput(path.tokens, path.fees);
        
//         // Set up swap parameters for multi-hop
//         ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
//             path: encodedPath,
//             recipient: recipient,
//             deadline: block.timestamp,
//             amountIn: ethAmount,
//             amountOutMinimum: 0 // In production, use an oracle for minimum amount
//         });
        
//         // Execute multi-hop swap and send tokens directly to recipient
//         uint amountOut = swapRouter.exactInput(params);
        
//         emit PaymentSent(recipient, finalToken, ethAmount, amountOut);
//     }
    
//         /**
//      * @notice Encodes the path for exactInput functions
//      * @param tokens Array of token addresses in the path
//      * @param fees Array of fees between each token pair
//      * @return Encoded path bytes as expected by the router
//      */
//     function encodePathForExactInput(address[] memory tokens, uint24[] memory fees)
//         internal
//         pure
//         returns (bytes memory)
//     {
//         bytes memory path = new bytes(0);
        
//         for (uint i = 0; i < tokens.length - 1; i++) {
//             if (i == 0) {
//                 // First pair
//                 path = abi.encodePacked(tokens[i], fees[i], tokens[i + 1]);
//             } else {
//                 // Subsequent pairs
//                 path = abi.encodePacked(path, fees[i], tokens[i + 1]);
//             }
//         }
        
//         return path;
//     }
    
//     /**
//      * @notice Recover any tokens accidentally sent to this contract
//      * @param token Address of token to recover (use address(0) for ETH)
//      */
//     function recoverFunds(address token) external {
//         require(msg.sender == owner, "Only owner");
        
//         if (token == address(0)) {
//             uint balance = address(this).balance;
//             if (balance > 0) {
//                 (bool success, ) = owner.call{value: balance}("");
//                 require(success, "ETH recovery failed");
//                 emit FundsRecovered(address(0), balance);
//             }
//         } else {
//             uint balance = IERC20(token).balanceOf(address(this));
//             if (balance > 0) {
//                 TransferHelper.safeTransfer(token, owner, balance);
//                 emit FundsRecovered(token, balance);
//             }
//         }
//     }
    
//     // Allow contract to receive ETH
//     receive() external payable {}
// }