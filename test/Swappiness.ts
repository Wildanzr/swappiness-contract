import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { formatUnits, parseEther, parseUnits } from "ethers";

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

  describe("swapExactOutput", () => {
    it("Should swap exact from ETH to USDC", async () => {
      const { signers, swappiness, usdc } = await loadFixture(
        deploySwappinessFixture
      );

      // Store initial balances
      const initialEthBalance = await ethers.provider.getBalance(
        signers[0].address
      );
      const initialUsdcBalance = await usdc.balanceOf(signers[0].address);

      // Define exact USDC output amount (10 USDC)
      const exactUsdcAmount = parseUnits("10", 6); // USDC has 6 decimals

      // Send excess ETH to cover the swap (0.01 ETH)
      const ethToSend = parseEther("0.01");

      // Pool fee for ETH/USDC is 0.05% = 500
      const poolFee = 500;

      // Execute the swap - tokenIn is address(0) for ETH
      const tx = await swappiness.swapExactOutput(
        ethers.ZeroAddress, // ETH input (address 0)
        USDC,
        exactUsdcAmount,
        ethToSend,
        poolFee,
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
      const finalUsdcBalance = await usdc.balanceOf(signers[0].address);

      // Calculate how much ETH was actually spent (excluding gas fees)
      const ethSpent = initialEthBalance - finalEthBalance - gasUsed;

      // Verify we received exactly the requested USDC amount
      expect(finalUsdcBalance).to.equal(initialUsdcBalance + exactUsdcAmount);

      // Verify ETH spent is less than or equal to what we sent
      expect(ethSpent).to.be.lte(ethToSend);

      // Log details for analysis
      console.log("--- ETH to USDC Swap Results ---");
      console.log("Initial ETH balance:", formatUnits(initialEthBalance, 18));
      console.log("Final ETH balance:", formatUnits(finalEthBalance, 18));
      console.log("ETH spent:", formatUnits(ethSpent, 18));
      console.log("Gas used (ETH):", formatUnits(gasUsed, 18));
      console.log("Initial USDC balance:", formatUnits(initialUsdcBalance, 6));
      console.log("Final USDC balance:", formatUnits(finalUsdcBalance, 6));

      // Calculate and log exchange rate
      const ethUsdcRate =
        Number(formatUnits(exactUsdcAmount, 6)) /
        Number(formatUnits(ethSpent, 18));
      console.log("Effective ETH/USDC rate:", ethUsdcRate.toFixed(2));
    });

    it("Should swap exact from USDC to DAI", async () => {
      const { signers, swappiness, usdc, dai } = await loadFixture(
        deploySwappinessFixture
      );

      // Need to acquire some USDC first via ETH->USDC swap
      // First get some USDC by swapping ETH
      const seedUsdcAmount = parseUnits("100", 6); // Get 100 USDC to start with
      const seedEthAmount = parseEther("0.06");

      await swappiness.swapExactOutput(
        ethers.ZeroAddress, // ETH input
        USDC,
        seedUsdcAmount,
        seedEthAmount,
        500, // 0.05% pool fee
        {
          value: seedEthAmount,
        }
      );

      // Store initial balances
      const initialUsdcBalance = await usdc.balanceOf(signers[0].address);
      const initialDaiBalance = await dai.balanceOf(signers[0].address);

      // Ensure we have enough USDC
      expect(initialUsdcBalance).to.be.gte(seedUsdcAmount);

      // Define exact DAI output amount (10 DAI)
      const exactDaiAmount = parseUnits("10", 18); // DAI has 18 decimals

      // Approve USDC for the contract to spend
      await usdc.approve(await swappiness.getAddress(), initialUsdcBalance);

      // Maximum USDC to spend (slightly more than 1:1 ratio)
      const usdcToSpend = parseUnits("11", 6);

      // Pool fee for USDC/DAI is 0.01% = 100
      const poolFee = 100;

      // Execute the swap
      const tx = await swappiness.swapExactOutput(
        USDC,
        DAI,
        exactDaiAmount,
        usdcToSpend,
        poolFee
      );
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Transaction failed");
      }

      // Check balances after swap
      const finalUsdcBalance = await usdc.balanceOf(signers[0].address);
      const finalDaiBalance = await dai.balanceOf(signers[0].address);

      // Calculate how much USDC was actually spent
      const usdcSpent = initialUsdcBalance - finalUsdcBalance;

      // Verify we received exactly the requested DAI amount
      expect(finalDaiBalance).to.equal(initialDaiBalance + exactDaiAmount);

      // Verify USDC spent is less than or equal to maximum
      expect(usdcSpent).to.be.lte(usdcToSpend);

      // Log details for analysis
      console.log("--- USDC to DAI Swap Results ---");
      console.log("Initial USDC balance:", formatUnits(initialUsdcBalance, 6));
      console.log("Final USDC balance:", formatUnits(finalUsdcBalance, 6));
      console.log("USDC spent:", formatUnits(usdcSpent, 6));
      console.log("Initial DAI balance:", formatUnits(initialDaiBalance, 18));
      console.log("Final DAI balance:", formatUnits(finalDaiBalance, 18));

      // Calculate and log exchange rate
      const usdcDaiRate =
        Number(formatUnits(exactDaiAmount, 18)) /
        Number(formatUnits(usdcSpent, 6));
      console.log("Effective USDC/DAI rate:", usdcDaiRate.toFixed(4));
    });

    it("Should swap exact from USDC to WETH", async () => {
      const { signers, swappiness, usdc, weth } = await loadFixture(
        deploySwappinessFixture
      );

      // Need to acquire some USDC first via ETH->USDC swap
      // First get some USDC by swapping ETH
      const seedUsdcAmount = parseUnits("100", 6); // Get 100 USDC to start with
      const seedEthAmount = parseEther("0.06");

      await swappiness.swapExactOutput(
        ethers.ZeroAddress, // ETH input
        USDC,
        seedUsdcAmount,
        seedEthAmount,
        500, // 0.05% pool fee
        {
          value: seedEthAmount,
        }
      );

      // Store initial balances
      const initialUsdcBalance = await usdc.balanceOf(signers[0].address);
      const initialWethBalance = await weth.balanceOf(signers[0].address);

      // Ensure we have enough USDC
      expect(initialUsdcBalance).to.be.gte(seedUsdcAmount);

      // Define exact WETH output amount (0.005 WETH)
      const exactEthAmount = parseEther("0.005");

      // Approve USDC for the contract to spend
      await usdc.approve(await swappiness.getAddress(), initialUsdcBalance);

      // Maximum USDC to spend
      const usdcToSpend = parseUnits("10", 6); // 10 USDC

      // Pool fee for USDC/ETH is 0.05% = 500
      const poolFee = 500;

      // Execute the swap
      const tx = await swappiness.swapExactOutput(
        USDC,
        WETH,
        exactEthAmount,
        usdcToSpend,
        poolFee
      );
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Transaction failed");
      }

      // Check balance after swap
      const finalUsdcBalance = await usdc.balanceOf(signers[0].address);
      const finalWethBalance = await weth.balanceOf(signers[0].address);

      // Calculate how much USDC was actually spent
      const usdcSpent = initialUsdcBalance - finalUsdcBalance;

      // Verify we received exactly the requested WETH amount
      expect(finalWethBalance).to.equal(initialWethBalance + exactEthAmount);

      // Verify USDC spent is less than or equal to maximum
      expect(usdcSpent).to.be.lte(usdcToSpend);

      // Log details for analysis
      console.log("--- USDC to WETH Swap Results ---");
      console.log("Initial USDC balance:", formatUnits(initialUsdcBalance, 6));
      console.log("Final USDC balance:", formatUnits(finalUsdcBalance, 6));
      console.log("USDC spent:", formatUnits(usdcSpent, 6));
      console.log("Initial WETH balance:", formatUnits(initialWethBalance, 18));
      console.log("Final WETH balance:", formatUnits(finalWethBalance, 18));
      console.log("WETH received:", formatUnits(exactEthAmount, 18));
      console.log(
        "Effective USDC/WETH rate:",
        Number(formatUnits(usdcSpent, 6)) /
          Number(formatUnits(exactEthAmount, 18))
      );
    });

    // it("Should swap exact from USDC to ETH", async () => {
    //   const { signers, swappiness, usdc } = await loadFixture(
    //     deploySwappinessFixture
    //   );

    //   // Need to acquire some USDC first via ETH->USDC swap
    //   // First get some USDC by swapping ETH
    //   const seedUsdcAmount = parseUnits("1000", 6); // Get 100 USDC to start with
    //   const seedEthAmount = parseEther("1");

    //   // Store initial balances
    //   let initialUsdcBalance = await usdc.balanceOf(signers[0].address);
    //   let initialEthBalance = await ethers.provider.getBalance(
    //     signers[0].address
    //   );

    //   console.log("Initial USDC balance:", formatUnits(initialUsdcBalance, 6));
    //   console.log("Initial ETH balance:", formatUnits(initialEthBalance, 18));

    //   await swappiness.swapExactOutput(
    //     ethers.ZeroAddress, // ETH input
    //     USDC,
    //     seedUsdcAmount,
    //     seedEthAmount,
    //     500, // 0.05% pool fee
    //     {
    //       value: seedEthAmount,
    //     }
    //   );
    //   await swappiness.swapExactOutput(
    //     ethers.ZeroAddress, // ETH input
    //     USDC,
    //     seedUsdcAmount,
    //     seedEthAmount,
    //     500, // 0.05% pool fee
    //     {
    //       value: seedEthAmount,
    //     }
    //   );
    //   await swappiness.swapExactOutput(
    //     ethers.ZeroAddress, // ETH input
    //     USDC,
    //     seedUsdcAmount,
    //     seedEthAmount,
    //     500, // 0.05% pool fee
    //     {
    //       value: seedEthAmount,
    //     }
    //   );
    //   await swappiness.swapExactOutput(
    //     ethers.ZeroAddress, // ETH input
    //     USDC,
    //     seedUsdcAmount,
    //     seedEthAmount,
    //     500, // 0.05% pool fee
    //     {
    //       value: seedEthAmount,
    //     }
    //   );
    //   await swappiness.swapExactOutput(
    //     ethers.ZeroAddress, // ETH input
    //     USDC,
    //     seedUsdcAmount,
    //     seedEthAmount,
    //     500, // 0.05% pool fee
    //     {
    //       value: seedEthAmount,
    //     }
    //   );

    //   initialUsdcBalance = await usdc.balanceOf(signers[0].address);
    //   initialEthBalance = await ethers.provider.getBalance(signers[0].address);

    //   console.log("After seeding USDC", formatUnits(initialUsdcBalance, 6));
    //   console.log("After seeding ETH", formatUnits(initialEthBalance, 18));

    //   // Ensure we have enough USDC
    //   expect(initialUsdcBalance).to.be.gte(seedUsdcAmount);

    //   // Define exact ETH output amount (1 ETH)
    //   const exactEthAmount = parseEther("1");

    //   // Approve USDC for the contract to spend
    //   await usdc.approve(await swappiness.getAddress(), initialUsdcBalance);

    //   // Maximum USDC to spend
    //   const usdcToSpend = parseUnits("2500", 6); // 10 USDC

    //   // Pool fee for USDC/ETH is 0.05% = 500
    //   const poolFee = 500;

    //   // Execute the swap
    //   const tx = await swappiness.swapExactOutput(
    //     USDC,
    //     ethers.ZeroAddress, // ETH output (address(0))
    //     exactEthAmount,
    //     usdcToSpend,
    //     poolFee
    //   );
    //   const receipt = await tx.wait();

    //   if (!receipt) {
    //     throw new Error("Transaction failed");
    //   }

    //   // Check balance after swap
    //   const finalUsdcBalance = await usdc.balanceOf(signers[0].address);
    //   const finalEthBalance = await ethers.provider.getBalance(
    //     signers[0].address
    //   );

    //   // Calculate how much USDC was actually spent
    //   const usdcSpent = initialUsdcBalance - finalUsdcBalance;

    //   // Verify USDC spent is less than or equal to maximum
    //   // expect(usdcSpent).to.be.lte(usdcToSpend);
    //   // Log details for analysis
    //   console.log("--- USDC to ETH Swap Results ---");
    //   console.log("Initial USDC balance:", formatUnits(initialUsdcBalance, 6));
    //   console.log("Final USDC balance:", formatUnits(finalUsdcBalance, 6));
    //   console.log("USDC spent:", formatUnits(usdcSpent, 6));
    //   console.log("Initial ETH balance:", formatUnits(initialEthBalance, 18));
    //   console.log("Final ETH balance:", formatUnits(finalEthBalance, 18));
    //   console.log(
    //     "Difference in ETH balance:",
    //     formatUnits(initialEthBalance - finalEthBalance, 18)
    //   );
    //   console.log(
    //     "Effective USDC/ETH rate:",
    //     Number(formatUnits(usdcSpent, 6)) /
    //       Number(formatUnits(exactEthAmount, 18))
    //   );
    // });
  });
});
