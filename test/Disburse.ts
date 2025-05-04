import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { formatUnits, parseEther } from "ethers";
import { IERC20, IWETH } from "../typechain-types";

// Token addresses on mainnet
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const WETH9 = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

// Enum mapping for readability
const PaymentType = {
  Direct: 0,
  MultiHop: 1,
};

type SwapPathStruct = {
  tokens: string[];
  fees: number[];
};

describe("PaymentDisburser", function () {
  async function deployDisburseFixture() {
    const signers = await hre.ethers.getSigners();
    const PaymentDisburser = await ethers.getContractFactory(
      "PaymentDisburser"
    );
    const paymentDisburser = await PaymentDisburser.deploy();

    const dai = (await ethers.getContractAt("IERC20", DAI)) as IERC20;
    const usdc = (await ethers.getContractAt("IERC20", USDC)) as IERC20;
    const weth = (await ethers.getContractAt("IWETH", WETH9)) as IWETH;

    return { signers, paymentDisburser, dai, usdc, weth };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { paymentDisburser, signers } = await loadFixture(
        deployDisburseFixture
      );

      expect(await paymentDisburser.owner()).to.equal(signers[0].address);
    });
  });

  describe("Should all balance be 0", function () {
    it("Should have 0 DAI balance", async function () {
      const { signers, dai } = await loadFixture(deployDisburseFixture);

      expect(await dai.balanceOf(signers[0].address)).to.equal(0);
    });

    it("Should have 0 USDC balance", async function () {
      const { signers, usdc } = await loadFixture(deployDisburseFixture);

      expect(await usdc.balanceOf(signers[0].address)).to.equal(0);
    });

    it("Should have 0 WETH balance", async function () {
      const { signers, weth } = await loadFixture(deployDisburseFixture);

      expect(await weth.balanceOf(signers[0].address)).to.equal(0);
    });
  });

  describe("Batch Disburse", function () {
    it("Should disburse to 2 addresses with direct payments", async function () {
      const { paymentDisburser, signers, dai, usdc, weth } = await loadFixture(
        deployDisburseFixture
      );

      const ethAmount = parseEther("1");
      const totalEthAmount = parseEther("2");

      const recipients = [signers[1].address, signers[2].address];
      const tokens = [await dai.getAddress(), await usdc.getAddress()];
      const ethAmounts = [ethAmount, ethAmount];
      const paymentTypes = [PaymentType.Direct, PaymentType.Direct];

      const paths: SwapPathStruct[] = [];

      // Recipients balance before
      const r1DaiBalanceBefore = await dai.balanceOf(signers[1].address);
      const r2UsdcBalanceBefore = await usdc.balanceOf(signers[2].address);
      const ownerBalanceBefore = await ethers.provider.getBalance(
        signers[0].address
      );
      // console.log(
      //   "Owner balance before: ",
      //   formatUnits(ownerBalanceBefore, 18)
      // );
      // console.log(
      //   "Recipient 1 DAI balance before: ",
      //   formatUnits(r1DaiBalanceBefore, 18)
      // );
      // console.log(
      //   "Recipient 2 USDC balance before: ",
      //   formatUnits(r2UsdcBalanceBefore, 6)
      // );

      // Execute the batch disburse
      const tx = await paymentDisburser.batchDisbursement(
        recipients,
        tokens,
        ethAmounts,
        paymentTypes,
        paths,
        { value: totalEthAmount }
      );

      // Get transaction receipt to calculate gas used
      const receipt = await tx.wait();
      const gasUsed = receipt?.gasUsed as bigint;
      const txDetails = await ethers.provider.getTransaction(tx.hash);
      const gasPrice = txDetails?.gasPrice;
      const gasFeeInWei = gasUsed * (gasPrice as bigint);

      // Recipients balance after
      const r1DaiBalanceAfter = await dai.balanceOf(signers[1].address);
      const r2UsdcBalanceAfter = await usdc.balanceOf(signers[2].address);
      const ownerBalanceAfter = await ethers.provider.getBalance(
        signers[0].address
      );
      // console.log("Owner balance after: ", formatUnits(ownerBalanceAfter, 18));
      // console.log(
      //   "Recipient 1 DAI balance after: ",
      //   formatUnits(r1DaiBalanceAfter, 18)
      // );
      // console.log(
      //   "Recipient 2 USDC balance after: ",
      //   formatUnits(r2UsdcBalanceAfter, 6)
      // );

      // console.log("Gas used: ", gasUsed.toString());
      // console.log("Gas price: ", gasPrice?.toString());

      // Verify both recipients received tokens
      expect(r1DaiBalanceAfter).to.be.gt(r1DaiBalanceBefore);
      expect(r2UsdcBalanceAfter).to.be.gt(r2UsdcBalanceBefore);
    });
  });

  describe("Multi-hop Payments", function () {
    it("Should process a multi-hop payment from ETH → USDC → DAI", async function () {
      const { paymentDisburser, signers, dai, usdc, weth } = await loadFixture(
        deployDisburseFixture
      );

      const ethAmount = parseEther("1");
      const totalEthAmount = parseEther("1");

      // Only one recipient for this test
      const recipients = [signers[1].address];
      const tokens = [await dai.getAddress()];
      const ethAmounts = [ethAmount];
      const paymentTypes = [PaymentType.MultiHop];

      // Define path: ETH → USDC → DAI correctly
      const paths: SwapPathStruct[] = [
        {
          tokens: [
            WETH9, // Start with WETH
            USDC, // Swap to USDC
            DAI, // End with DAI
          ],
          fees: [
            3000, // 0.3% fee for WETH-USDC pool
            100, // 0.01% fee for USDC-DAI pool
          ],
        },
      ];

      // Track recipient balance before
      const r1DaiBalanceBefore = await dai.balanceOf(signers[1].address);
      const ownerBalanceBefore = await ethers.provider.getBalance(
        signers[0].address
      );

      // console.log(
      //   "Owner balance before: ",
      //   formatUnits(ownerBalanceBefore, 18)
      // );
      // console.log(
      //   "Recipient DAI balance before: ",
      //   formatUnits(r1DaiBalanceBefore, 18)
      // );

      // Execute the multi-hop payment
      const tx = await paymentDisburser.batchDisbursement(
        recipients,
        tokens,
        ethAmounts,
        paymentTypes,
        paths,
        { value: totalEthAmount }
      );

      // Get transaction receipt
      const receipt = await tx.wait();
      const gasUsed = receipt?.gasUsed as bigint;
      const txDetails = await ethers.provider.getTransaction(tx.hash);
      const gasPrice = txDetails?.gasPrice;

      // Check balances after
      const r1DaiBalanceAfter = await dai.balanceOf(signers[1].address);
      const ownerBalanceAfter = await ethers.provider.getBalance(
        signers[0].address
      );

      // console.log("Owner balance after: ", formatUnits(ownerBalanceAfter, 18));
      // console.log(
      //   "Recipient DAI balance after: ",
      //   formatUnits(r1DaiBalanceAfter, 18)
      // );
      // console.log("Gas used for multi-hop: ", gasUsed.toString());
      // console.log("Gas price: ", gasPrice?.toString());
      // console.log(
      //   "DAI received via multi-hop: ",
      //   formatUnits(r1DaiBalanceAfter - r1DaiBalanceBefore, 18)
      // );

      // Verify recipient received DAI tokens through the multi-hop path
      expect(r1DaiBalanceAfter).to.be.gt(r1DaiBalanceBefore);
    });

    it("Should compare direct vs multi-hop for the same token pair", async function () {
      const { paymentDisburser, signers, dai, usdc, weth } = await loadFixture(
        deployDisburseFixture
      );

      const ethAmount = parseEther("0.5");
      const totalEthAmount = parseEther("1");

      // Two payments for comparison - both ETH to DAI
      const recipients = [signers[1].address, signers[2].address];
      const tokens = [await dai.getAddress(), await dai.getAddress()];
      const ethAmounts = [ethAmount, ethAmount];
      const paymentTypes = [PaymentType.Direct, PaymentType.MultiHop];

      // Define path for multi-hop: ETH → USDC → DAI
      const paths: SwapPathStruct[] = [
        {
          tokens: [], // Empty for direct payment
          fees: [], // Empty for direct payment
        },
        {
          tokens: [WETH9, USDC, DAI],
          fees: [3000, 100],
        },
      ];

      // Track recipient balances before
      const r1DaiBalanceBefore = await dai.balanceOf(signers[1].address);
      const r2DaiBalanceBefore = await dai.balanceOf(signers[2].address);

      // console.log(
      //   "Recipient 1 DAI balance before (Direct): ",
      //   formatUnits(r1DaiBalanceBefore, 18)
      // );
      // console.log(
      //   "Recipient 2 DAI balance before (Multi-hop): ",
      //   formatUnits(r2DaiBalanceBefore, 18)
      // );

      // Execute the disbursement
      const tx = await paymentDisburser.batchDisbursement(
        recipients,
        tokens,
        ethAmounts,
        paymentTypes,
        paths,
        { value: totalEthAmount }
      );

      await tx.wait();

      // Check balances after
      const r1DaiBalanceAfter = await dai.balanceOf(signers[1].address);
      const r2DaiBalanceAfter = await dai.balanceOf(signers[2].address);

      // console.log(
      //   "Recipient 1 DAI balance after (Direct): ",
      //   formatUnits(r1DaiBalanceAfter, 18)
      // );
      // console.log(
      //   "Recipient 2 DAI balance after (Multi-hop): ",
      //   formatUnits(r2DaiBalanceAfter, 18)
      // );

      const directGain = r1DaiBalanceAfter - r1DaiBalanceBefore;
      const multiHopGain = r2DaiBalanceAfter - r2DaiBalanceBefore;

      // console.log(
      //   "DAI received via direct route: ",
      //   formatUnits(directGain, 18)
      // );
      // console.log(
      //   "DAI received via multi-hop: ",
      //   formatUnits(multiHopGain, 18)
      // );
      // console.log(
      //   "Difference (%): ",
      //   formatUnits((multiHopGain * 10000n) / directGain - 10000n, 2),
      //   "%"
      // );

      // Verify both recipients received tokens
      expect(r1DaiBalanceAfter).to.be.gt(r1DaiBalanceBefore);
      expect(r2DaiBalanceAfter).to.be.gt(r2DaiBalanceBefore);

      // Note: We don't assert which path is better as this depends on market conditions
    });
  });
});
