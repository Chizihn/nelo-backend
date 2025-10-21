import { ethers } from "ethers";
import { env } from "@/config/env";
import { CngnService } from "../blockchain/cngnService";
import { logger } from "@/utils/logger";

export class FeeService {
  // Your business wallet address where fees are collected
  private static readonly FEE_COLLECTOR_ADDRESS = env.FEE_COLLECTOR_ADDRESS;

  /**
   * Calculate transaction fee
   */
  static calculateTransactionFee(amount: string): {
    originalAmount: number;
    feeAmount: number;
    netAmount: number;
    feePercentage: number;
  } {
    const originalAmount = parseFloat(amount);
    const feePercentage = 0.005; // 0.5% fee
    const minFee = 10; // Minimum 10 cNGN fee
    const maxFee = 1000; // Maximum 1000 cNGN fee

    let feeAmount = Math.max(
      minFee,
      Math.min(maxFee, originalAmount * feePercentage)
    );
    const netAmount = originalAmount - feeAmount;

    return {
      originalAmount,
      feeAmount,
      netAmount,
      feePercentage: feePercentage * 100, // Convert to percentage
    };
  }

  /**
   * Process transfer with fee collection
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
      const feeInfo = this.calculateTransactionFee(amount);

      // Check if sender has enough balance for amount + fee
      const senderWallet = new ethers.Wallet(senderPrivateKey);
      const senderAddress = senderWallet.address;
      const balance = await CngnService.getBalance(senderAddress);

      if (parseFloat(balance.balance) < feeInfo.originalAmount) {
        return {
          success: false,
          error: `Insufficient balance. Need ${feeInfo.originalAmount} cNGN (including ${feeInfo.feeAmount} cNGN fee)`,
        };
      }

      // First collect fee to business wallet (if configured)
      let feeCollected = 0;
      if (feeInfo.feeAmount > 0 && this.FEE_COLLECTOR_ADDRESS) {
        const feeResult = await CngnService.transfer(
          senderPrivateKey,
          this.FEE_COLLECTOR_ADDRESS,
          feeInfo.feeAmount.toString()
        );

        if (feeResult.success) {
          feeCollected = feeInfo.feeAmount;
          logger.info(`Fee collected: ${feeInfo.feeAmount} cNGN`);
        } else {
          logger.warn(`Fee collection failed: ${feeResult.error}`);
          // Continue with main transfer even if fee collection fails
        }
      }

      // Transfer net amount to recipient
      const transferResult = await CngnService.transfer(
        senderPrivateKey,
        recipientAddress,
        feeInfo.netAmount.toString()
      );

      if (!transferResult.success) {
        return transferResult;
      }

      return {
        success: true,
        txHash: transferResult.txHash,
        feeCollected,
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
  static getFeeInfo(amount: string): string {
    const feeInfo = this.calculateTransactionFee(amount);

    return `💰 *Transaction Details*

Amount: ${feeInfo.originalAmount} cNGN
Fee (${feeInfo.feePercentage}%): ${feeInfo.feeAmount} cNGN
Recipient gets: ${feeInfo.netAmount} cNGN

Total deducted from your balance: ${feeInfo.originalAmount} cNGN`;
  }
}
