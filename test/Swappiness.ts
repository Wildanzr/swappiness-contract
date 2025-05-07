import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { formatUnits, parseEther } from "ethers";

import { IERC20, IWETH } from "../typechain-types/contracts/interfaces";

const USDT = "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2";
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const DAI = "0x50c5725949a6f0c72e6c4a641f24049a917db0cb";
const IDRX = "0x18bc5bcc660cf2b9ce3cd51a404afe1a0cbd3c22";
const WETH = "0x4200000000000000000000000000000000000006";

describe("Swappiness", () => {
  const deploySwappinessFixture = async () => {
    const signers = await hre.ethers.getSigners();

    const Swappiness = await hre.ethers.getContractFactory("Swappiness");
    const swappiness = await Swappiness.deploy();
    await swappiness.waitForDeployment();

    const usdt = (await ethers.getContractAt(
      "contracts/interfaces/IERC20.sol:IERC20",
      USDT
    )) as unknown as IERC20;
    const usdc = (await ethers.getContractAt(
      "contracts/interfaces/IERC20.sol:IERC20",
      USDC
    )) as unknown as IERC20;
    const dai = (await ethers.getContractAt(
      "contracts/interfaces/IERC20.sol:IERC20",
      DAI
    )) as unknown as IERC20;
    const idrx = (await ethers.getContractAt(
      "contracts/interfaces/IERC20.sol:IERC20",
      IDRX
    )) as unknown as IERC20;
    const weth = (await ethers.getContractAt("IWETH", WETH)) as IWETH;

    return {
      swappiness,
      signers,
      usdt,
      usdc,
      dai,
      idrx,
      weth,
    };
  };

  describe("Deployment", () => {
    it("Should set the right owner", async () => {
      const { swappiness, signers } = await loadFixture(
        deploySwappinessFixture
      );

      expect(await swappiness.owner()).to.equal(signers[0].address);
    });

    describe("Should check balance for listed tokens", async () => {
      it("Should check USDT balance", async () => {
        const { signers, usdt } = await loadFixture(deploySwappinessFixture);

        const balance = await usdt.balanceOf(signers[0].address);
        expect(balance).to.equal(0);
      });

      it("Should check USDC balance", async () => {
        const { signers, usdc } = await loadFixture(deploySwappinessFixture);

        const balance = await usdc.balanceOf(signers[0].address);
        expect(balance).to.equal(0);
      });

      it("Should check DAI balance", async () => {
        const { signers, dai } = await loadFixture(deploySwappinessFixture);

        const balance = await dai.balanceOf(signers[0].address);
        expect(balance).to.equal(0);
      });

      it("Should check IDRX balance", async () => {
        const { signers, idrx } = await loadFixture(deploySwappinessFixture);

        const balance = await idrx.balanceOf(signers[0].address);
        expect(balance).to.equal(0);
      });

      it("Should check WETH balance", async () => {
        const { signers, weth } = await loadFixture(deploySwappinessFixture);

        const balance = await weth.balanceOf(signers[0].address);
        expect(balance).to.equal(0);
      });
    });
  });

  describe("SimpleSwapExactOut", () => {
    it("Should swap ETH for exact amount of USDC", async () => {
      const { signers, swappiness, usdc } = await loadFixture(
        deploySwappinessFixture
      );

      const initialEthBalance = await ethers.provider.getBalance(
        signers[0].address
      );
      const initialUsdcBalance = await usdc.balanceOf(signers[0].address);

      const exactUsdcAmount = BigInt(10_000_000); // 10 USDC for testing
      const ethToSend = parseEther("0.006"); // Reasonable amount for 10 USDC

      const tx = await swappiness.simpleSwapExactOutput(exactUsdcAmount, {
        value: ethToSend,
      });

      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error("Transaction failed");
      }

      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const finalEthBalance = await ethers.provider.getBalance(
        signers[0].address
      );
      const finalUsdcBalance = await usdc.balanceOf(signers[0].address);

      expect(finalUsdcBalance).to.equal(initialUsdcBalance + exactUsdcAmount);
      expect(initialEthBalance - finalEthBalance - gasUsed).to.be.lte(
        ethToSend
      );

      console.log("Initial ETH balance:", formatUnits(initialEthBalance, 18));
      console.log("Final ETH balance:", formatUnits(finalEthBalance, 18));
      console.log("Maximum ETH amount:", formatUnits(ethToSend, 18));
      console.log(
        "Actual ETH spent:",
        formatUnits(initialEthBalance - finalEthBalance - gasUsed, 18)
      );
      console.log("Gas used (ETH):", formatUnits(gasUsed, 18));
      console.log("Final USDC balance:", formatUnits(finalUsdcBalance, 6));
    });
  });

  describe("SimpleMultiHopSwapExactOut", () => {
    it("Should swap ETH for exact amount of DAI through USDC", async () => {
      const { signers, swappiness, dai } = await loadFixture(
        deploySwappinessFixture
      );

      // Store initial balances
      const initialEthBalance = await ethers.provider.getBalance(
        signers[0].address
      );
      const initialDaiBalance = await dai.balanceOf(signers[0].address);

      // Define exact DAI output amount (10 DAI)
      const exactDaiAmount = BigInt(10_000_000_000_000_000_000n); // 10 DAI with 18 decimals

      // Send excess ETH to cover the swap (0.01 ETH)
      const ethToSend = parseEther("0.06");

      // Execute the multi-hop swap
      const tx = await swappiness.simpleMultiHopSwapExactOutput(
        exactDaiAmount,
        {
          value: ethToSend,
        }
      );
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Transaction failed");
      }

      // Calculate gas cost
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      // Check balances after swap
      const finalEthBalance = await ethers.provider.getBalance(
        signers[0].address
      );
      const finalDaiBalance = await dai.balanceOf(signers[0].address);

      // Calculate how much ETH was actually spent (excluding gas fees)
      const ethSpent = initialEthBalance - finalEthBalance - gasUsed;

      // Verify we received exactly the requested DAI amount
      expect(finalDaiBalance).to.equal(initialDaiBalance + exactDaiAmount);

      // Verify ETH spent is less than or equal to what we sent
      expect(ethSpent).to.be.lte(ethToSend);

      // Log details for analysis
      console.log("--- Multi-hop Swap Results (ETH → USDC → DAI) ---");
      console.log("Initial ETH balance:", formatUnits(initialEthBalance, 18));
      console.log("Final ETH balance:", formatUnits(finalEthBalance, 18));
      console.log("Maximum ETH amount:", formatUnits(ethToSend, 18));
      console.log("Actual ETH spent:", formatUnits(ethSpent, 18));
      console.log("Gas used (ETH):", formatUnits(gasUsed, 18));
      console.log("Initial DAI balance:", formatUnits(initialDaiBalance, 18));
      console.log("Final DAI balance:", formatUnits(finalDaiBalance, 18));

      // Calculate and log exchange rate
      const ethDaiRate =
        Number(formatUnits(exactDaiAmount, 18)) /
        Number(formatUnits(ethSpent, 18));
      console.log("Effective ETH/DAI rate:", ethDaiRate.toFixed(2));
    });
  });
});
