import { ethers } from "ethers";
import { env } from "@/config/env";
import { CngnService } from "../blockchain/cngnService";
import { logger } from "@/utils/logger";

export class FeeService {
  // Your business wallet address where fees are collected
  private static readonly FEE_COLLECTOR_ADDRESS = env.FEE_COLLECTOR_ADDRESS;

  // Gas fee configuration
  private static readonly GAS_FEE_CONFIG = {
    // Gas costs for different operations (in gas units)
    TRANSFER: 21000,
    DEPOSIT_TO_CUSTODY: 50000,
    WITHDRAW_FROM_CUSTODY: 45000,
    APPROVE: 46000,

    // Gas price buffer (multiply by this for safety)
    GAS_PRICE_BUFFER: 1.2,

    // Minimum gas fee in cNGN (to cover at least basic transfer)
    MIN_GAS_FEE_CNGN: 50, // 50 cNGN minimum
  };

  /**
   * Estimate gas fee in ETH for a transaction type
   */
  static async estimateGasFeeETH(
    transactionType:
      | "TRANSFER"
      | "DEPOSIT_TO_CUSTODY"
      | "WITHDRAW_FROM_CUSTODY"
      | "APPROVE"
  ): Promise<{
    gasLimit: number;
    gasPriceWei: bigint;
    gasFeeETH: string;
    gasFeeWei: bigint;
  }> {
    try {
      const { provider, GAS_SETTINGS } = await import("@/config/blockchain");

      const gasLimit = this.GAS_FEE_CONFIG[transactionType];
      const gasPriceWei = GAS_SETTINGS.maxFeePerGas;
      const bufferedGasPrice = BigInt(
        Math.floor(Number(gasPriceWei) * this.GAS_FEE_CONFIG.GAS_PRICE_BUFFER)
      );

      const gasFeeWei = BigInt(gasLimit) * bufferedGasPrice;
      const gasFeeETH = ethers.formatEther(gasFeeWei);

      return {
        gasLimit,
        gasPriceWei: bufferedGasPrice,
        gasFeeETH,
        gasFeeWei,
      };
    } catch (error) {
      logger.error("Error estimating gas fee:", error);
      // Fallback to conservative estimate
      return {
        gasLimit: 50000,
        gasPriceWei: ethers.parseUnits("2", "gwei"),
        gasFeeETH: "0.0001",
        gasFeeWei: ethers.parseUnits("0.0001", "ether"),
      };
    }
  }

  /**
   * Convert ETH gas fee to cNGN equivalent
   */
  static async convertGasFeeToNGN(gasFeeETH: string): Promise<{
    gasFeeNGN: number;
    gasFeeUSD: number;
    ethPriceUSD: number;
    usdToNgnRate: number;
  }> {
    try {
      // Get ETH price in USD (you can use a price oracle or API)
      // For now, using approximate values - in production, use real price feeds
      const ethPriceUSD = 2500; // $2500 per ETH (update with real price)
      const usdToNgnRate = 1600; // 1600 NGN per USD (update with real rate)

      const gasFeeUSD = parseFloat(gasFeeETH) * ethPriceUSD;
      const gasFeeNGN = gasFeeUSD * usdToNgnRate;

      return {
        gasFeeNGN: Math.ceil(gasFeeNGN), // Round up to nearest NGN
        gasFeeUSD,
        ethPriceUSD,
        usdToNgnRate,
      };
    } catch (error) {
      logger.error("Error converting gas fee to NGN:", error);
      // Conservative fallback
      return {
        gasFeeNGN: 100, // 100 NGN fallback
        gasFeeUSD: 0.0625,
        ethPriceUSD: 2500,
        usdToNgnRate: 1600,
      };
    }
  }

  /**
   * Calculate total transaction cost including gas
   */
  static async calculateTotalTransactionCost(
    amount: string,
    transactionType:
      | "TRANSFER"
      | "DEPOSIT_TO_CUSTODY"
      | "WITHDRAW_FROM_CUSTODY"
      | "APPROVE"
  ): Promise<{
    originalAmount: number;
    serviceFee: number;
    gasFeeNGN: number;
    gasFeeETH: string;
    totalCostNGN: number;
    netAmountToRecipient: number;
    breakdown: string;
  }> {
    try {
      const originalAmount = parseFloat(amount);

      // Calculate service fee (existing logic)
      const serviceFeePercentage = 0.001; // 0.5% service fee
      const minServiceFee = 10; // Minimum 10 cNGN
      const maxServiceFee = 1000; // Maximum 1000 cNGN

      const serviceFee = Math.max(
        minServiceFee,
        Math.min(maxServiceFee, originalAmount * serviceFeePercentage)
      );

      // Calculate gas fee
      const gasEstimate = await this.estimateGasFeeETH(transactionType);
      const gasConversion = await this.convertGasFeeToNGN(
        gasEstimate.gasFeeETH
      );

      // Ensure minimum gas fee
      const gasFeeNGN = Math.max(
        this.GAS_FEE_CONFIG.MIN_GAS_FEE_CNGN,
        gasConversion.gasFeeNGN
      );

      // Calculate totals
      const totalCostNGN = originalAmount + serviceFee + gasFeeNGN;
      const netAmountToRecipient = originalAmount; // Recipient gets full amount, sender pays fees

      const breakdown = `💰 *Transaction Breakdown*

Amount to send: ${originalAmount.toLocaleString()} cNGN
Service fee (0.5%): ${serviceFee.toLocaleString()} cNGN
Gas fee: ${gasFeeNGN.toLocaleString()} cNGN (~${gasEstimate.gasFeeETH} ETH)

Total cost: ${totalCostNGN.toLocaleString()} cNGN
Recipient receives: ${netAmountToRecipient.toLocaleString()} cNGN`;

      return {
        originalAmount,
        serviceFee,
        gasFeeNGN,
        gasFeeETH: gasEstimate.gasFeeETH,
        totalCostNGN,
        netAmountToRecipient,
        breakdown,
      };
    } catch (error) {
      logger.error("Error calculating total transaction cost:", error);
      throw new Error("Failed to calculate transaction costs");
    }
  }

  /**
   * Calculate transaction fee (legacy method - now includes gas)
   */
  static async calculateTransactionFee(amount: string): Promise<{
    originalAmount: number;
    feeAmount: number;
    netAmount: number;
    feePercentage: number;
    gasFeeNGN: number;
    totalDeduction: number;
  }> {
    const originalAmount = parseFloat(amount);
    const feePercentage = 0.001; // 0.5% fee
    const minFee = 10; // Minimum 10 cNGN fee
    const maxFee = 1000; // Maximum 1000 cNGN fee

    let serviceFee = Math.max(
      minFee,
      Math.min(maxFee, originalAmount * feePercentage)
    );

    // Add gas fee calculation
    const gasEstimate = await this.estimateGasFeeETH("TRANSFER");
    const gasConversion = await this.convertGasFeeToNGN(gasEstimate.gasFeeETH);
    const gasFeeNGN = Math.max(
      this.GAS_FEE_CONFIG.MIN_GAS_FEE_CNGN,
      gasConversion.gasFeeNGN
    );

    const totalDeduction = serviceFee + gasFeeNGN;
    const netAmount = originalAmount - totalDeduction;

    return {
      originalAmount,
      feeAmount: serviceFee,
      netAmount,
      feePercentage: feePercentage * 100,
      gasFeeNGN,
      totalDeduction,
    };
  }

  /**
   * Process transfer with user-paid fees (service + gas)
   */
  static async processTransferWithUserPaidFees(
    senderPrivateKey: string,
    recipientAddress: string,
    amount: string,
    tokenAddress: string
  ): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
    feesCollected?: {
      serviceFee: number;
      gasFeeNGN: number;
      totalFees: number;
    };
  }> {
    try {
      // Calculate total costs including gas
      const costBreakdown = await this.calculateTotalTransactionCost(
        amount,
        "TRANSFER"
      );

      // Check if user has enough balance for total cost
      const senderWallet = new ethers.Wallet(senderPrivateKey);
      const balance = await CngnService.getBalance(senderWallet.address);

      if (parseFloat(balance.balance) < costBreakdown.totalCostNGN) {
        return {
          success: false,
          error: `Insufficient balance. Need ${costBreakdown.totalCostNGN.toLocaleString()} cNGN, have ${parseFloat(
            balance.balance
          ).toLocaleString()} cNGN`,
        };
      }

      // Step 1: Collect service fee
      const serviceFeeResult = await CngnService.transfer(
        senderPrivateKey,
        this.FEE_COLLECTOR_ADDRESS || "",
        costBreakdown.serviceFee.toString()
      );

      if (!serviceFeeResult.success) {
        return {
          success: false,
          error: "Failed to collect service fee",
        };
      }

      // Step 2: Collect gas fee (convert cNGN to ETH for gas payment)
      const gasFeeResult = await this.collectGasFeeFromUser(
        senderPrivateKey,
        costBreakdown.gasFeeNGN,
        costBreakdown.gasFeeETH
      );

      if (!gasFeeResult.success) {
        return {
          success: false,
          error: `Failed to collect gas fee: ${gasFeeResult.error}`,
        };
      }

      // Step 3: Transfer the original amount to recipient (using collected gas)
      const mainTransferResult = await CngnService.transfer(
        senderPrivateKey,
        recipientAddress,
        amount // Full amount goes to recipient
      );

      if (!mainTransferResult.success) {
        return {
          success: false,
          error: "Failed to transfer funds to recipient",
        };
      }

      logger.info(
        `Transfer completed with user-paid fees: ${amount} cNGN to ${recipientAddress}, service fee: ${costBreakdown.serviceFee} cNGN, gas fee: ${costBreakdown.gasFeeNGN} cNGN`
      );

      return {
        success: true,
        txHash: mainTransferResult.txHash,
        feesCollected: {
          serviceFee: costBreakdown.serviceFee,
          gasFeeNGN: costBreakdown.gasFeeNGN,
          totalFees: costBreakdown.serviceFee + costBreakdown.gasFeeNGN,
        },
      };
    } catch (error) {
      logger.error("Error processing transfer with user-paid fees:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Transfer failed",
      };
    }
  }

  /**
   * Collect gas fee from user (convert cNGN to ETH for gas payment)
   */
  private static async collectGasFeeFromUser(
    userPrivateKey: string,
    gasFeeNGN: number,
    gasFeeETH: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Transfer cNGN gas fee to fee collector
      // In production, this would be converted to ETH to pay for gas
      const gasTransferResult = await CngnService.transfer(
        userPrivateKey,
        this.FEE_COLLECTOR_ADDRESS || "",
        gasFeeNGN.toString()
      );

      if (!gasTransferResult.success) {
        return {
          success: false,
          error: "Failed to collect gas fee in cNGN",
        };
      }

      // TODO: In production, implement actual cNGN -> ETH conversion
      // For now, we collect cNGN equivalent and backend still pays ETH gas
      // This could be done via:
      // 1. DEX swap (cNGN -> ETH)
      // 2. Off-chain conversion service
      // 3. Gas station network

      logger.info(
        `Collected ${gasFeeNGN} cNGN as gas fee (equivalent to ${gasFeeETH} ETH)`
      );
      return { success: true };
    } catch (error) {
      logger.error("Error collecting gas fee from user:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Gas fee collection failed",
      };
    }
  }

  /**
   * Process transfer with fee collection (legacy method)
   */
  static async processTransferWithFee(
    senderPrivateKey: string,
    recipientAddress: string,
    amount: string
  ): Promise<{
    success: boolean;
    txHash?: string;
    feeCollected?: number;
    error?: string;
  }> {
    try {
      const feeInfo = await this.calculateTransactionFee(amount);

      // Check if sender has enough balance for amount + fee
      const senderWallet = new ethers.Wallet(senderPrivateKey);
      const senderAddress = senderWallet.address;
      const balance = await CngnService.getBalance(senderAddress);

      if (parseFloat(balance.balance) < feeInfo.originalAmount) {
        return {
          success: false,
          error: `Insufficient balance. Need ${feeInfo.originalAmount} cNGN (including ${feeInfo.totalDeduction} cNGN total fees)`,
        };
      }

      // First collect the total fees (service + gas)
      const totalFeeTransferResult = await CngnService.transfer(
        senderPrivateKey,
        this.FEE_COLLECTOR_ADDRESS || "",
        feeInfo.totalDeduction.toString()
      );

      if (!totalFeeTransferResult.success) {
        return {
          success: false,
          error: "Failed to collect transaction fees",
        };
      }

      // Then transfer the net amount to recipient
      const mainTransferResult = await CngnService.transfer(
        senderPrivateKey,
        recipientAddress,
        feeInfo.netAmount.toString()
      );

      if (!mainTransferResult.success) {
        return {
          success: false,
          error: "Failed to transfer funds to recipient",
        };
      }

      logger.info(
        `Transfer completed: ${feeInfo.netAmount} cNGN to ${recipientAddress}, total fees: ${feeInfo.totalDeduction} cNGN (service: ${feeInfo.feeAmount}, gas: ${feeInfo.gasFeeNGN})`
      );

      return {
        success: true,
        txHash: mainTransferResult.txHash,
        feeCollected: feeInfo.totalDeduction,
      };
    } catch (error) {
      logger.error("Error processing transfer with fee:", error);
      return {
        success: false,
        error: "Transfer failed",
      };
    }
  }

  /**
   * Get fee information for display
   */
  static async getFeeInfo(amount: string): Promise<string> {
    const feeInfo = await this.calculateTransactionFee(amount);

    return `💰 *Transaction Details*

Amount: ${feeInfo.originalAmount} cNGN
Fee (${feeInfo.feePercentage}%): ${feeInfo.feeAmount} cNGN
Recipient gets: ${feeInfo.netAmount} cNGN

Total deducted from your balance: ${feeInfo.originalAmount} cNGN`;
  }
}
