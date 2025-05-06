// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;
interface IRouterV2{
        function getAmountsOut(
                uint amountIn,
                address[] memory path
                ) external
                returns (uint[] memory amounts);

        function swapExactETHForTokens(
                uint amountOutMin,
                address[] calldata path,
                address to,
                uint deadline
                )
                external
                returns (uint[] memory amounts);
        function swapExactTokensForTokens(
                uint amountIn,
                uint amountOutMin,
                address[] calldata path,
                address to,
                uint deadline
        ) external returns (uint[] memory amounts);
        function swapExactTokensForETH(
                uint amountIn,
                uint amountOutMin,
                address[] calldata path,
                address to,
                uint deadline
                )
                external
                returns (uint[] memory amounts);
}