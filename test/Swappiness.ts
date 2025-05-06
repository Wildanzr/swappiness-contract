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

  describe("Swap ETH to ERC20", () => {
    it("Should swap ETH to USDC", async () => {
      const { signers, swappiness, usdc } = await loadFixture(
        deploySwappinessFixture
      );

      // Store initial balances
      const initialEthBalance = await ethers.provider.getBalance(
        signers[0].address
      );
      const initialUsdcBalance = await usdc.balanceOf(signers[0].address);

      // Amount of ETH to swap (0.01 ETH)
      const swapAmount = parseEther("0.01");

      // Execute the swap
      const tx = await swappiness.execute(USDC, { value: swapAmount });
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Transaction failed");
      }

      // Get gas used for the transaction
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      // Check balances after swap
      const finalEthBalance = await ethers.provider.getBalance(
        signers[0].address
      );
      const finalUsdcBalance = await usdc.balanceOf(signers[0].address);

      console.log("Final ETH balance:", formatUnits(finalEthBalance, 18));
      console.log("Final USDC balance:", formatUnits(finalUsdcBalance, 6));

      // Verify ETH was spent (swap amount + gas)
      expect(initialEthBalance - finalEthBalance).to.be.closeTo(
        swapAmount + gasUsed,
        parseEther("0.0001") // Small allowance for calculation differences
      );

      // Verify USDC was received
      expect(finalUsdcBalance).to.be.gt(initialUsdcBalance);

      // Calculate how much USDC we got for our ETH to determine the exchange rate
      const usdcReceived = finalUsdcBalance - initialUsdcBalance;
      const ethUsdRate =
        Number(formatUnits(usdcReceived, 6)) /
        Number(formatUnits(swapAmount, 18));

      console.log(
        "USDC received:",
        formatUnits(usdcReceived, 6) // USDC has 6 decimals
      );

      // Calculate and log the gas cost in USD
      const gasUsedInEth = formatUnits(gasUsed, 18);
      const gasUsedInUsd = Number(gasUsedInEth) * ethUsdRate;
      console.log(
        "Gas used: ",
        gasUsedInEth,
        "ETH ($" + gasUsedInUsd.toFixed(2) + ")"
      );
    });

    // it("Should swap ETH to DAI", async () => {
    //   const { signers, swappiness, dai } = await loadFixture(
    //     deploySwappinessFixture
    //   );

    //   // Store initial balances
    //   const initialEthBalance = await ethers.provider.getBalance(
    //     signers[0].address
    //   );
    //   const initialDaiBalance = await dai.balanceOf(signers[0].address);

    //   // Amount of ETH to swap (0.01 ETH)
    //   const swapAmount = parseEther("0.01");

    //   // Execute the swap
    //   const tx = await swappiness.execute(DAI, { value: swapAmount });
    //   const receipt = await tx.wait();

    //   if (!receipt) {
    //     throw new Error("Transaction failed");
    //   }

    //   // Get gas used for the transaction
    //   const gasUsed = receipt.gasUsed * receipt.gasPrice;

    //   // Check balances after swap
    //   const finalEthBalance = await ethers.provider.getBalance(
    //     signers[0].address
    //   );
    //   const finalDaiBalance = await dai.balanceOf(signers[0].address);

    //   // Verify ETH was spent (swap amount + gas)
    //   expect(initialEthBalance - finalEthBalance).to.be.closeTo(
    //     swapAmount + gasUsed,
    //     parseEther("0.0001") // Small allowance for calculation differences
    //   );

    //   // Verify DAI was received
    //   expect(finalDaiBalance).to.be.gt(initialDaiBalance);

    //   // Calculate how much DAI we got for our ETH to determine the exchange rate
    //   const daiReceived = finalDaiBalance - initialDaiBalance;
    //   const ethUsdRate =
    //     Number(formatUnits(daiReceived, 18)) /
    //     Number(formatUnits(swapAmount, 18));

    //   console.log(
    //     "DAI received:",
    //     formatUnits(daiReceived, 18) // DAI has 18 decimals
    //   );

    //   // Calculate and log the gas cost in USD
    //   const gasUsedInEth = formatUnits(gasUsed, 18);
    //   const gasUsedInUsd = Number(gasUsedInEth) * ethUsdRate;
    //   console.log(
    //     "Gas used: ",
    //     gasUsedInEth,
    //     "ETH ($" + gasUsedInUsd.toFixed(2) + ")"
    //   );
    // });

    // it("Should swap ETH to IDRX", async () => {
    //   const { signers, swappiness, idrx } = await loadFixture(
    //     deploySwappinessFixture
    //   );

    //   // Store initial balances
    //   const initialEthBalance = await ethers.provider.getBalance(
    //     signers[0].address
    //   );
    //   const initialIdrxBalance = await idrx.balanceOf(signers[0].address);

    //   // Amount of ETH to swap (0.1 ETH)
    //   const swapAmount = parseEther("0.1");

    //   // Execute the swap
    //   const tx = await swappiness.execute(IDRX, { value: swapAmount });
    //   const receipt = await tx.wait();

    //   if (!receipt) {
    //     throw new Error("Transaction failed");
    //   }

    //   // Get gas used for the transaction
    //   const gasUsed = receipt.gasUsed * receipt.gasPrice;

    //   // Check balances after swap
    //   const finalEthBalance = await ethers.provider.getBalance(
    //     signers[0].address
    //   );
    //   const finalIdrxBalance = await idrx.balanceOf(signers[0].address);

    //   // Verify ETH was spent (swap amount + gas)
    //   expect(initialEthBalance - finalEthBalance).to.be.closeTo(
    //     swapAmount + gasUsed,
    //     parseEther("0.0001") // Small allowance for calculation differences
    //   );

    //   // Verify IDRX was received
    //   expect(finalIdrxBalance).to.be.gt(initialIdrxBalance);

    //   // Calculate how much IDRX we got for our ETH to determine the exchange rate
    //   const idrxReceived = finalIdrxBalance - initialIdrxBalance;
    //   const ethUsdRate =
    //     Number(formatUnits(idrxReceived, 18)) /
    //     Number(formatUnits(swapAmount, 18));

    //   console.log(
    //     "IDRX received:",
    //     formatUnits(idrxReceived, 18) // IDRX has 18 decimals
    //   );

    //   // Calculate and log the gas cost in USD
    //   const gasUsedInEth = formatUnits(gasUsed, 18);
    //   const gasUsedInUsd = Number(gasUsedInEth) * ethUsdRate;
    //   console.log(
    //     "Gas used: ",
    //     gasUsedInEth,
    //     "ETH ($" + gasUsedInUsd.toFixed(2) + ")"
    //   );
    // });

    // it("Should swap ETH to USDT", async () => {
    //   const { signers, swappiness, usdt } = await loadFixture(
    //     deploySwappinessFixture
    //   );

    //   // Store initial balances
    //   const initialEthBalance = await ethers.provider.getBalance(
    //     signers[0].address
    //   );
    //   const initialUsdtBalance = await usdt.balanceOf(signers[0].address);

    //   // Amount of ETH to swap (0.01 ETH)
    //   const swapAmount = parseEther("0.01");

    //   // Execute the swap
    //   const tx = await swappiness.execute(USDT, { value: swapAmount });
    //   const receipt = await tx.wait();

    //   if (!receipt) {
    //     throw new Error("Transaction failed");
    //   }

    //   // Get gas used for the transaction
    //   const gasUsed = receipt.gasUsed * receipt.gasPrice;

    //   // Check balances after swap
    //   const finalEthBalance = await ethers.provider.getBalance(
    //     signers[0].address
    //   );
    //   const finalUsdtBalance = await usdt.balanceOf(signers[0].address);

    //   console.log("Final ETH balance:", formatUnits(finalEthBalance, 18));
    //   console.log("Final USDT balance:", formatUnits(finalUsdtBalance, 6));

    //   // // Verify ETH was spent (swap amount + gas)
    //   // expect(initialEthBalance - finalEthBalance).to.be.closeTo(
    //   //   swapAmount + gasUsed,
    //   //   parseEther("0.0001") // Small allowance for calculation differences
    //   // );

    //   // // Verify USDT was received
    //   // expect(finalUsdtBalance).to.be.gt(initialUsdtBalance);

    //   // // Calculate how much USDT we got for our ETH to determine the exchange rate
    //   // const usdtReceived = finalUsdtBalance - initialUsdtBalance;
    //   // const ethUsdRate =
    //   //   Number(formatUnits(usdtReceived, 6)) /
    //   //   Number(formatUnits(swapAmount, 18));

    //   // console.log(
    //   //   "USDT received:",
    //   //   formatUnits(usdtReceived, 6) // USDT has 6 decimals
    //   // );

    //   // // Calculate and log the gas cost in USD
    //   // const gasUsedInEth = formatUnits(gasUsed, 18);
    //   // const gasUsedInUsd = Number(gasUsedInEth) * ethUsdRate;
    //   // console.log(
    //   //   "Gas used: ",
    //   //   gasUsedInEth,
    //   //   "ETH ($" + gasUsedInUsd.toFixed(2) + ")"
    //   // );
    // });
  });

  describe("SwapExactOut", () => {
    it("Should swap ETH for exact amount of USDC", async () => {
      const { signers, swappiness, usdc } = await loadFixture(
        deploySwappinessFixture
      );

      // Store initial balances
      const initialEthBalance = await ethers.provider.getBalance(
        signers[0].address
      );
      const initialUsdcBalance = await usdc.balanceOf(signers[0].address);

      // Define exact USDC output amount (10 USDC)
      const amountOut = BigInt(10_000_000); // 10 USDC with 6 decimals

      // Maximum ETH willing to spend (0.5 ETH)
      const amountInMaximum = parseEther("0.5");

      // Execute the exact output swap
      const tx = await swappiness.swapExactOutput(
        ethers.ZeroAddress, // address(0) for ETH input
        USDC, // USDC as output token
        amountOut, // Exact amount of USDC to receive
        amountInMaximum, // Maximum ETH to spend
        { value: amountInMaximum } // Send ETH with the transaction
      );
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Transaction failed");
      }

      // Get gas used for the transaction
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      // Check balances after swap
      const finalEthBalance = await ethers.provider.getBalance(
        signers[0].address
      );
      const finalUsdcBalance = await usdc.balanceOf(signers[0].address);

      // Calculate actual ETH spent (excluding gas)
      const actualEthSpent = initialEthBalance - finalEthBalance - gasUsed;
      const ethRefunded = amountInMaximum - actualEthSpent;

      console.log("Initial ETH balance:", formatUnits(initialEthBalance, 18));
      console.log("Final ETH balance:", formatUnits(finalEthBalance, 18));
      console.log("Maximum ETH amount:", formatUnits(amountInMaximum, 18));
      console.log("Actual ETH spent:", formatUnits(actualEthSpent, 18));
      console.log("ETH refunded:", formatUnits(ethRefunded, 18));
      console.log("Gas used (ETH):", formatUnits(gasUsed, 18));
      console.log("Final USDC balance:", formatUnits(finalUsdcBalance, 6));
      console.log(
        "USDC received:",
        formatUnits(finalUsdcBalance - initialUsdcBalance, 6)
      );
      console.log(
        "ETH/USDC rate:",
        Number(formatUnits(finalUsdcBalance - initialUsdcBalance, 6)) /
          Number(formatUnits(actualEthSpent, 18))
      );

      // Verify ETH was spent but less than maximum (excluding gas)
      expect(actualEthSpent).to.be.lt(amountInMaximum);
      expect(actualEthSpent).to.be.gt(0);

      // Verify EXACTLY the requested USDC was received
      expect(finalUsdcBalance - initialUsdcBalance).to.equal(amountOut);
    });

    // it("Should fail when insufficient ETH sent for exact output swap", async () => {
    //   const { swappiness } = await loadFixture(deploySwappinessFixture);

    //   // Define exact USDC output amount (1000 USDC - likely too much for the test ETH)
    //   const amountOut = BigInt(1_000_000_000); // 1000 USDC with 6 decimals

    //   // Maximum ETH willing to spend (0.001 ETH - likely too little)
    //   const amountInMaximum = parseEther("0.001");

    //   // Expect the transaction to be reverted
    //   await expect(
    //     swappiness.swapExactOutput(
    //       ethers.ZeroAddress, // address(0) for ETH input
    //       USDC, // USDC as output token
    //       amountOut, // Exact amount of USDC to receive (too high)
    //       amountInMaximum, // Maximum ETH to spend (too low)
    //       { value: amountInMaximum }
    //     )
    //   ).to.be.reverted;
    // });

    // it("Should swap ETH for exact amount of DAI", async () => {
    //   const { signers, swappiness, dai } = await loadFixture(
    //     deploySwappinessFixture
    //   );

    //   // Store initial balances
    //   const initialEthBalance = await ethers.provider.getBalance(
    //     signers[0].address
    //   );
    //   const initialDaiBalance = await dai.balanceOf(signers[0].address);

    //   // Define exact DAI output amount (10 DAI)
    //   const amountOut = parseEther("10"); // DAI has 18 decimals like ETH

    //   // Maximum ETH willing to spend (0.02 ETH)
    //   const amountInMaximum = parseEther("0.02");

    //   // Execute the exact output swap
    //   const tx = await swappiness.swapExactOutput(
    //     ethers.ZeroAddress, // address(0) for ETH input
    //     DAI, // DAI as output token
    //     amountOut, // Exact amount of DAI to receive
    //     amountInMaximum, // Maximum ETH to spend
    //     { value: amountInMaximum } // Send ETH with the transaction
    //   );
    //   const receipt = await tx.wait();

    //   if (!receipt) {
    //     throw new Error("Transaction failed");
    //   }

    //   // Check balances after swap
    //   const finalEthBalance = await ethers.provider.getBalance(
    //     signers[0].address
    //   );
    //   const finalDaiBalance = await dai.balanceOf(signers[0].address);

    //   // Verify EXACTLY the requested DAI was received
    //   expect(finalDaiBalance - initialDaiBalance).to.equal(amountOut);

    //   // Calculate gas used
    //   const gasUsed = receipt.gasUsed * receipt.gasPrice;
    //   const ethSpent = initialEthBalance - finalEthBalance - gasUsed;

    //   console.log(
    //     "SwapExactOut - ETH spent for DAI (excluding gas):",
    //     formatUnits(ethSpent, 18)
    //   );
    //   console.log("SwapExactOut - DAI received:", formatUnits(amountOut, 18));
    // });

    // it("Should allow specifying WETH as input token", async () => {
    //   const { signers, swappiness, weth, usdc } = await loadFixture(
    //     deploySwappinessFixture
    //   );

    //   // First we need to get some WETH to the contract
    //   const depositAmount = parseEther("0.05");
    //   await weth.deposit({ value: depositAmount });
    //   await weth.transfer(await swappiness.getAddress(), depositAmount);

    //   // Define exact USDC output amount (10 USDC)
    //   const amountOut = BigInt(10_000_000); // 10 USDC with 6 decimals

    //   // Maximum WETH willing to spend (0.02 ETH)
    //   const amountInMaximum = parseEther("0.02");

    //   // Initial USDC balance
    //   const initialUsdcBalance = await usdc.balanceOf(signers[0].address);

    //   // Execute the exact output swap using WETH directly
    //   const tx = await swappiness.swapExactOutput(
    //     WETH, // WETH as input token
    //     USDC, // USDC as output token
    //     amountOut, // Exact amount of USDC to receive
    //     amountInMaximum // Maximum WETH to spend
    //   );
    //   await tx.wait();

    //   // Verify USDC received
    //   const finalUsdcBalance = await usdc.balanceOf(signers[0].address);
    //   expect(finalUsdcBalance - initialUsdcBalance).to.equal(amountOut);

    //   console.log(
    //     "SwapExactOut - WETH->USDC: USDC received:",
    //     formatUnits(finalUsdcBalance - initialUsdcBalance, 6)
    //   );
    // });

    // // This test would require you to have some ERC20 tokens to test with
    // // We'll mark it as skipped, but you can enable it when needed
    // it.skip("Should swap ERC20 token for exact amount of another ERC20", async () => {
    //   const { signers, swappiness, usdc, dai } = await loadFixture(
    //     deploySwappinessFixture
    //   );

    //   // For this to work, we'd need to have some USDC in our wallet
    //   // This would typically be done by first swapping ETH for USDC
    //   // or by using a faucet/testnet token source

    //   // Define amounts
    //   const usdcToSpend = BigInt(20_000_000); // 20 USDC with 6 decimals
    //   const daiToReceive = parseEther("10"); // 10 DAI with 18 decimals

    //   // Approve USDC to be used by the contract
    //   await usdc.approve(await swappiness.getAddress(), usdcToSpend);

    //   // Initial balances
    //   const initialDaiBalance = await dai.balanceOf(signers[0].address);
    //   const initialUsdcBalance = await usdc.balanceOf(signers[0].address);

    //   // Execute the swap
    //   const tx = await swappiness.swapExactOutput(
    //     USDC, // USDC as input token
    //     DAI, // DAI as output token
    //     daiToReceive, // Exact amount of DAI to receive
    //     usdcToSpend // Maximum USDC to spend
    //   );
    //   await tx.wait();

    //   // Verify balances
    //   const finalDaiBalance = await dai.balanceOf(signers[0].address);
    //   const finalUsdcBalance = await usdc.balanceOf(signers[0].address);

    //   // Verify DAI received
    //   expect(finalDaiBalance - initialDaiBalance).to.equal(daiToReceive);

    //   // Verify some USDC was spent (could be less than maximum)
    //   expect(initialUsdcBalance - finalUsdcBalance).to.be.gt(0);
    //   expect(initialUsdcBalance - finalUsdcBalance).to.be.lte(usdcToSpend);
    // });
  });
});
