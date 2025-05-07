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
const EURC = "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42";

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

  describe("DisperseToStablecoins", () => {
    it("Should disperse ETH to multiple recipients as different stablecoins including multi-hop routes", async () => {
      const { signers, swappiness, usdc, dai, usdt } = await loadFixture(
        deploySwappinessFixture
      );

      // Define recipient addresses - using signers[1], signers[2], and signers[3] as recipients
      const recipient1 = signers[1].address;
      const recipient2 = signers[2].address;
      const recipient3 = signers[3].address;

      // Store initial balances
      const initialEthBalance = await ethers.provider.getBalance(
        signers[0].address
      );
      const initialUsdcBalanceRecipient1 = await usdc.balanceOf(recipient1);
      const initialDaiBalanceRecipient2 = await dai.balanceOf(recipient2);
      const initialUsdtBalanceRecipient3 = await usdt.balanceOf(recipient3);

      // Define exact output amounts
      const usdcAmount = BigInt(10_000_000); // 10 USDC (6 decimals)
      const daiAmount = BigInt(10_000_000_000_000_000_000n); // 10 DAI (18 decimals)
      const usdtAmount = BigInt(10_000_000); // 10 USDT (6 decimals)

      // Maximum ETH willing to spend per swap
      const ethMaxForUsdc = parseEther("0.1");
      const ethMaxForDai = parseEther("0.1");
      const ethMaxForUsdt = parseEther("0.1"); // For the multi-hop ETH -> USDC -> USDT
      const totalEthToSend = ethMaxForUsdc + ethMaxForDai + ethMaxForUsdt;

      // Prepare parameters for disperseToStablecoins
      const recipients = [recipient1, recipient2, recipient3];
      const tokenOuts = [usdc.target, dai.target, usdt.target];
      const amountOuts = [usdcAmount, daiAmount, usdtAmount];
      const amountInMaxs = [ethMaxForUsdc, ethMaxForDai, ethMaxForUsdt];

      // Execute the disperse function
      const tx = await swappiness.disperseToStablecoins(
        ethers.ZeroAddress, // address(0) represents ETH as input
        recipients,
        tokenOuts,
        amountOuts,
        amountInMaxs,
        { value: totalEthToSend }
      );

      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error("Transaction failed");
      }

      // Calculate gas cost
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      // Check balances after disperse
      const finalEthBalance = await ethers.provider.getBalance(
        signers[0].address
      );
      const finalUsdcBalanceRecipient1 = await usdc.balanceOf(recipient1);
      const finalDaiBalanceRecipient2 = await dai.balanceOf(recipient2);
      const finalUsdtBalanceRecipient3 = await usdt.balanceOf(recipient3);

      // Verify recipients received exactly the requested amounts
      expect(finalUsdcBalanceRecipient1).to.equal(
        initialUsdcBalanceRecipient1 + usdcAmount
      );
      expect(finalDaiBalanceRecipient2).to.equal(
        initialDaiBalanceRecipient2 + daiAmount
      );
      expect(finalUsdtBalanceRecipient3).to.equal(
        initialUsdtBalanceRecipient3 + usdtAmount
      );

      // Calculate how much ETH was actually spent (excluding gas fees)
      const ethSpent = initialEthBalance - finalEthBalance - gasUsed;

      // Verify ETH spent is less than or equal to what we sent
      expect(ethSpent).to.be.lte(totalEthToSend);

      // Log details for analysis
      console.log("--- Disperse to Stablecoins Results (with Multi-hop) ---");
      console.log("Initial ETH balance:", formatUnits(initialEthBalance, 18));
      console.log("Final ETH balance:", formatUnits(finalEthBalance, 18));
      console.log("Total ETH sent:", formatUnits(totalEthToSend, 18));
      console.log("Actual ETH spent:", formatUnits(ethSpent, 18));
      console.log("Gas used (ETH):", formatUnits(gasUsed, 18));

      console.log(
        "Recipient 1 final USDC balance:",
        formatUnits(finalUsdcBalanceRecipient1, 6)
      );
      console.log(
        "Recipient 2 final DAI balance:",
        formatUnits(finalDaiBalanceRecipient2, 18)
      );
      console.log(
        "Recipient 3 final USDT balance:",
        formatUnits(finalUsdtBalanceRecipient3, 6)
      );

      // Calculate and log exchange rates
      const ethUsdcRate =
        Number(formatUnits(usdcAmount, 6)) /
        (Number(formatUnits(ethSpent, 18)) / 3); // Dividing by 3 since we have 3 swaps
      const ethDaiRate =
        Number(formatUnits(daiAmount, 18)) /
        (Number(formatUnits(ethSpent, 18)) / 3);
      const ethUsdtRate =
        Number(formatUnits(usdtAmount, 6)) /
        (Number(formatUnits(ethSpent, 18)) / 3);

      console.log("Approximate ETH/USDC rate:", ethUsdcRate.toFixed(2));
      console.log("Approximate ETH/DAI rate:", ethDaiRate.toFixed(2));
      console.log(
        "Approximate ETH/USDT rate (via USDC):",
        ethUsdtRate.toFixed(2)
      );
    });

    it("Should disperse USDC to multiple recipients as different stablecoins", async () => {
      const { signers, swappiness, usdc, dai, usdt } = await loadFixture(
        deploySwappinessFixture
      );

      // Get some USDC first by swapping ETH
      const swapAmount = BigInt(1000_000_000); // 1000 USDC for testing
      const ethToSwap = parseEther("1");

      await swappiness.simpleSwapExactOutput(swapAmount, {
        value: ethToSwap,
      });

      // Define recipient addresses - using signers[1] and signers[2] as recipients
      const recipient1 = signers[1].address;
      const recipient2 = signers[2].address;

      // Store initial balances
      const initialUsdcBalance = await usdc.balanceOf(signers[0].address);
      const initialDaiBalanceRecipient1 = await dai.balanceOf(recipient1);
      const initialUsdtBalanceRecipient2 = await usdt.balanceOf(recipient2);

      // Define exact output amounts
      const daiAmount = BigInt(10_000_000_000_000_000_000n); // 10 DAI (18 decimals)
      const usdtAmount = BigInt(10_000_000); // 10 USDT (6 decimals)

      // Maximum USDC willing to spend per swap
      const usdcMaxForDai = BigInt(12_000_000); // 12 USDC
      const usdcMaxForUsdt = BigInt(12_000_000); // 12 USDC
      const totalUsdcToSpend = usdcMaxForDai + usdcMaxForUsdt;

      // Approve USDC for the swappiness contract
      await usdc.approve(swappiness.target, totalUsdcToSpend);

      // Prepare parameters for disperseToStablecoins
      const recipients = [recipient1, recipient2];
      const tokenOuts = [dai.target, usdt.target];
      const amountOuts = [daiAmount, usdtAmount];
      const amountInMaxs = [usdcMaxForDai, usdcMaxForUsdt];

      // Execute the disperse function
      const tx = await swappiness.disperseToStablecoins(
        usdc.target, // USDC as input
        recipients,
        tokenOuts,
        amountOuts,
        amountInMaxs
      );

      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error("Transaction failed");
      }

      // Check balances after disperse
      const finalUsdcBalance = await usdc.balanceOf(signers[0].address);
      const finalDaiBalanceRecipient1 = await dai.balanceOf(recipient1);
      const finalUsdtBalanceRecipient2 = await usdt.balanceOf(recipient2);

      console.log(
        "Final USDC balance of sender:",
        formatUnits(finalUsdcBalance, 6)
      );
      console.log(
        "Final DAI balance of recipient 1:",
        formatUnits(finalDaiBalanceRecipient1, 18)
      );
      console.log(
        "Final USDT balance of recipient 2:",
        formatUnits(finalUsdtBalanceRecipient2, 6)
      );

      // Verify recipients received exactly the requested amounts
      expect(finalDaiBalanceRecipient1).to.equal(
        initialDaiBalanceRecipient1 + daiAmount
      );
      expect(finalUsdtBalanceRecipient2).to.equal(
        initialUsdtBalanceRecipient2 + usdtAmount
      );

      // Calculate how much USDC was actually spent
      const usdcSpent = initialUsdcBalance - finalUsdcBalance;

      // Verify USDC spent is less than or equal to what we approved
      expect(usdcSpent).to.be.lte(totalUsdcToSpend);

      // Log details for analysis
      console.log("--- Disperse USDC to Stablecoins Results ---");
      console.log("Initial USDC balance:", formatUnits(initialUsdcBalance, 6));
      console.log("Final USDC balance:", formatUnits(finalUsdcBalance, 6));
      console.log("Total USDC approved:", formatUnits(totalUsdcToSpend, 6));
      console.log("Actual USDC spent:", formatUnits(usdcSpent, 6));

      console.log(
        "Recipient 1 final DAI balance:",
        formatUnits(finalDaiBalanceRecipient1, 18)
      );
      console.log(
        "Recipient 2 final USDT balance:",
        formatUnits(finalUsdtBalanceRecipient2, 6)
      );
    });
  });
});
