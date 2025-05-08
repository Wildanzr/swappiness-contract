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
  });

  describe("disperseToStablecoins", async () => {
    it("Should disperse ETH to multiple stablecoins (USDC and DAI) to different recipients", async () => {
      const { signers, swappiness, usdc, dai } = await loadFixture(
        deploySwappinessFixture
      );

      // Use different signers as recipients
      const recipient1 = signers[5];
      const recipient2 = signers[7];

      // Store initial balances
      const initialEthBalance = await ethers.provider.getBalance(
        signers[0].address
      );
      const initialUsdcBalance1 = await usdc.balanceOf(recipient1.address);
      const initialDaiBalance2 = await dai.balanceOf(recipient2.address);

      // Define exact output amounts
      const exactUsdcAmount = parseUnits("10", 6); // 10 USDC
      const exactDaiAmount = parseUnits("15", 18); // 15 DAI

      // Maximum ETH to spend for each swap
      const ethForUsdc = parseEther("0.008"); // 0.008 ETH max for USDC
      const ethForDai = parseEther("0.012"); // 0.012 ETH max for DAI
      const totalEthToSend = ethForUsdc + ethForDai;

      // Create paths for each swap
      // For ETH -> USDC: tokenOut + fee + tokenIn
      const pathToUsdc = ethers.solidityPacked(
        ["address", "uint24", "address"],
        [USDC, 500, WETH] // 0.05% fee
      );

      // For ETH -> DAI: tokenOut + fee + tokenIn
      const pathToDai = ethers.solidityPacked(
        ["address", "uint24", "address"],
        [DAI, 500, WETH] // 0.05% fee
      );

      // Execute the disperseToStablecoins with different recipients
      const tx = await swappiness.disperseToStablecoins(
        ethers.ZeroAddress, // ETH input
        [recipient1.address, recipient2.address], // different recipients
        [USDC, DAI], // output tokens
        [exactUsdcAmount, exactDaiAmount], // exact output amounts
        [ethForUsdc, ethForDai], // max input amounts
        [pathToUsdc, pathToDai], // paths
        {
          value: totalEthToSend,
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
      const finalUsdcBalance1 = await usdc.balanceOf(recipient1.address);
      const finalDaiBalance2 = await dai.balanceOf(recipient2.address);

      // Calculate how much ETH was actually spent (excluding gas fees)
      const ethSpent = initialEthBalance - finalEthBalance - gasUsed;

      // Verify recipients received exactly the requested token amounts
      expect(finalUsdcBalance1).to.equal(initialUsdcBalance1 + exactUsdcAmount);
      expect(finalDaiBalance2).to.equal(initialDaiBalance2 + exactDaiAmount);

      // Verify ETH spent is less than or equal to what we sent
      expect(ethSpent).to.be.lte(totalEthToSend);

      // Log details
      console.log("--- ETH to Multiple Recipients Disperse Results ---");
      console.log("Initial ETH balance:", formatUnits(initialEthBalance, 18));
      console.log("Final ETH balance:", formatUnits(finalEthBalance, 18));
      console.log("Total ETH sent:", formatUnits(totalEthToSend, 18));
      console.log("Actual ETH spent:", formatUnits(ethSpent, 18));
      console.log("Gas used (ETH):", formatUnits(gasUsed, 18));
      console.log(
        `USDC received by recipient1 (${recipient1.address}):`,
        formatUnits(exactUsdcAmount, 6)
      );
      console.log(
        `DAI received by recipient2 (${recipient2.address}):`,
        formatUnits(exactDaiAmount, 18)
      );
    });

    it("Should disperse USDC to multiple tokens (DAI and WETH) to different recipients", async () => {
      const { signers, swappiness, usdc, dai, weth } = await loadFixture(
        deploySwappinessFixture
      );

      // Use different signers as recipients
      const recipient1 = signers[5];
      const recipient2 = signers[7];

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
      const initialDaiBalance1 = await dai.balanceOf(recipient1.address);
      const initialWethBalance2 = await weth.balanceOf(recipient2.address);

      // Ensure we have enough USDC
      expect(initialUsdcBalance).to.be.gte(seedUsdcAmount);

      // Define exact output amounts
      const exactDaiAmount = parseUnits("15", 18); // 15 DAI
      const exactWethAmount = parseEther("0.005"); // 0.005 WETH

      // Maximum USDC to spend for each swap
      const usdcForDai = parseUnits("16", 6); // 16 USDC max for DAI
      const usdcForWeth = parseUnits("10", 6); // 10 USDC max for WETH
      const totalUsdcToSpend = usdcForDai + usdcForWeth;

      // Approve USDC for the contract to spend
      await usdc.approve(await swappiness.getAddress(), totalUsdcToSpend);

      // Create paths for each swap
      // For USDC -> DAI: tokenOut + fee + tokenIn
      const pathToDai = ethers.solidityPacked(
        ["address", "uint24", "address"],
        [DAI, 100, USDC] // 0.01% fee
      );

      // For USDC -> WETH: tokenOut + fee + tokenIn
      const pathToWeth = ethers.solidityPacked(
        ["address", "uint24", "address"],
        [WETH, 500, USDC] // 0.05% fee
      );

      // Execute the disperseToStablecoins with different recipients
      const tx = await swappiness.disperseToStablecoins(
        USDC, // USDC input
        [recipient1.address, recipient2.address], // different recipients
        [DAI, WETH], // output tokens
        [exactDaiAmount, exactWethAmount], // exact output amounts
        [usdcForDai, usdcForWeth], // max input amounts
        [pathToDai, pathToWeth] // paths
      );

      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error("Transaction failed");
      }

      // Check balances after swap
      const finalUsdcBalance = await usdc.balanceOf(signers[0].address);
      const finalDaiBalance1 = await dai.balanceOf(recipient1.address);
      const finalWethBalance2 = await weth.balanceOf(recipient2.address);

      // Calculate how much USDC was actually spent
      const usdcSpent = initialUsdcBalance - finalUsdcBalance;

      // Verify recipients received exactly the requested token amounts
      expect(finalDaiBalance1).to.equal(initialDaiBalance1 + exactDaiAmount);
      expect(finalWethBalance2).to.equal(initialWethBalance2 + exactWethAmount);

      // Verify USDC spent is less than or equal to maximum
      expect(usdcSpent).to.be.lte(totalUsdcToSpend);

      // Log details
      console.log("--- USDC to Multiple Recipients Disperse Results ---");
      console.log("Initial USDC balance:", formatUnits(initialUsdcBalance, 6));
      console.log("Final USDC balance:", formatUnits(finalUsdcBalance, 6));
      console.log("USDC spent:", formatUnits(usdcSpent, 6));
      console.log(
        `DAI received by recipient1 (${recipient1.address}):`,
        formatUnits(exactDaiAmount, 18)
      );
      console.log(
        `WETH received by recipient2 (${recipient2.address}):`,
        formatUnits(exactWethAmount, 18)
      );
    });

    it("Should disperse ETH to DAI using multi-hop path through USDC to a different recipient", async () => {
      const { signers, swappiness, dai } = await loadFixture(
        deploySwappinessFixture
      );

      // Use a different signer as recipient
      const recipient = signers[5];

      // Store initial balances
      const initialEthBalance = await ethers.provider.getBalance(
        signers[0].address
      );
      const initialDaiBalance = await dai.balanceOf(recipient.address);

      // Define exact DAI output amount
      const exactDaiAmount = parseUnits("20", 18); // 20 DAI

      // Maximum ETH to spend
      const maxEthToSpend = parseEther("0.015"); // 0.015 ETH

      // Create multi-hop path: ETH -> USDC -> DAI
      // Path is encoded in reverse: DAI -> USDC -> WETH
      const multiHopPath = ethers.solidityPacked(
        ["address", "uint24", "address", "uint24", "address"],
        [DAI, 100, USDC, 500, WETH] // DAI -0.01%-> USDC -0.05%-> WETH
      );

      // Execute the disperseToStablecoins with a multi-hop path
      const tx = await swappiness.disperseToStablecoins(
        ethers.ZeroAddress, // ETH input
        [recipient.address], // different recipient
        [DAI], // output token
        [exactDaiAmount], // exact output amount
        [maxEthToSpend], // max input amount
        [multiHopPath], // multi-hop path
        {
          value: maxEthToSpend,
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
      const finalDaiBalance = await dai.balanceOf(recipient.address);

      // Calculate how much ETH was actually spent (excluding gas fees)
      const ethSpent = initialEthBalance - finalEthBalance - gasUsed;

      // Verify recipient received exactly the requested DAI amount
      expect(finalDaiBalance).to.equal(initialDaiBalance + exactDaiAmount);

      // Verify ETH spent is less than or equal to max
      expect(ethSpent).to.be.lte(maxEthToSpend);

      // Log details
      console.log(
        "--- ETH to DAI Multi-Hop to Different Recipient Results ---"
      );
      console.log("Initial ETH balance:", formatUnits(initialEthBalance, 18));
      console.log("Final ETH balance:", formatUnits(finalEthBalance, 18));
      console.log("Maximum ETH amount:", formatUnits(maxEthToSpend, 18));
      console.log("Actual ETH spent:", formatUnits(ethSpent, 18));
      console.log("Gas used (ETH):", formatUnits(gasUsed, 18));
      console.log(
        `Initial DAI balance of recipient (${recipient.address}):`,
        formatUnits(initialDaiBalance, 18)
      );
      console.log(
        `Final DAI balance of recipient (${recipient.address}):`,
        formatUnits(finalDaiBalance, 18)
      );
      console.log(
        `DAI received by recipient:`,
        formatUnits(exactDaiAmount, 18)
      );

      // Calculate and log effective exchange rate
      const ethDaiRate =
        Number(formatUnits(exactDaiAmount, 18)) /
        Number(formatUnits(ethSpent, 18));
      console.log("Effective ETH/DAI rate:", ethDaiRate.toFixed(2));
    });
  });
});
