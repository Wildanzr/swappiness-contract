import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { IERC20, IWETH, Swappiness } from "../typechain-types";

task("swap-usdc", "Swap ETH for USDC").setAction(
  async (_taskArgs: TaskArguments, hre) => {
    const { ethers } = hre;

    const swappinessAddress = "0x2A69c74A20e0960fAa763a9859B10d6766DCDda1";
    const USDT = "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2";
    const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
    const DAI = "0x50c5725949a6f0c72e6c4a641f24049a917db0cb";
    const IDRX = "0x18bc5bcc660cf2b9ce3cd51a404afe1a0cbd3c22";
    const WETH = "0x4200000000000000000000000000000000000006";
    const EURC = "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42";

    const usdc = (await ethers.getContractAt(
      "contracts/interfaces/IERC20.sol:IERC20",
      USDC
    )) as unknown as IERC20;
    const usdt = (await ethers.getContractAt(
      "contracts/interfaces/IERC20.sol:IERC20",
      USDT
    )) as unknown as IERC20;
    const dai = (await ethers.getContractAt(
      "contracts/interfaces/IERC20.sol:IERC20",
      DAI
    )) as unknown as IERC20;
    const idrx = (await ethers.getContractAt(
      "contracts/interfaces/IERC20.sol:IERC20",
      IDRX
    )) as unknown as IERC20;
    const eurc = (await ethers.getContractAt(
      "contracts/interfaces/IERC20.sol:IERC20",
      EURC
    )) as unknown as IERC20;
    const weth = (await ethers.getContractAt("IWETH", WETH)) as IWETH;

    const swappiness = (await ethers.getContractAt(
      "Swappiness",
      swappinessAddress
    )) as Swappiness;

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Using signer:", await signer.getAddress());

    console.log("Swappiness owner", await swappiness.connect(signer).owner());

    const seedUsdcAmount = ethers.parseUnits("100", 6);
    const seedEthAmount = ethers.parseUnits("0.3", 18);

    await swappiness.swapExactOutput(
      ethers.ZeroAddress,
      USDC,
      seedUsdcAmount,
      seedEthAmount,
      500,
      { value: seedEthAmount }
    );

    const usdcBalance = await usdc.balanceOf(await signer.getAddress());
    console.log("USDC balance after swap:", ethers.formatUnits(usdcBalance, 6));
  }
);
