import { prisma } from "@/config/database";
import { CngnService } from "../blockchain/cngnService";
import { UserService } from "../user/userService";
import { logger } from "@/utils/logger";
import { OffRampRequest } from "@/types/card.types";

export class OffRampService {
  /**
   * Initiate off-ramp process (convert cNGN to NGN)
   */
  static async initiateOffRamp(request: OffRampRequest): Promise<{
    success: boolean;
    transactionId?: string;
    estimatedTime?: string;
    error?: string;
  }> {
    try {
      // Get user with private key
      const user = await UserService.getUserWithPrivateKey(request.userId);
      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Check cNGN balance
      const balance = await CngnService.getBalance(user.walletAddress);
      const requestAmount = parseFloat(request.amount);

      if (parseFloat(balance.balance) < requestAmount) {
        return { success: false, error: "Insufficient cNGN balance" };
      }

      // Validate bank account details
      if (!request.bankAccount) {
        return { success: false, error: "Bank account details required" };
      }

      const bankAccount = request.bankAccount;
      const { accountNumber, bankCode, accountName } = bankAccount;
      if (!accountNumber || !bankCode || !accountName) {
        return {
          success: false,
          error: "Complete bank account details required",
        };
      }

      // Create off-ramp transaction record
      const transaction = await prisma.transaction.create({
        data: {
          userId: request.userId,
          type: "OFFRAMP",
          amount: requestAmount,
          currency: "cNGN",
          status: "PENDING",
          description: `Off-ramp ${request.amount} cNGN to ${accountName}`,
          metadata: {
            bankAccount: bankAccount,
            exchangeRate: 1.0, // 1 cNGN = 1 NGN
            estimatedNGN: requestAmount,
          },
        },
      });

      logger.info(
        `Off-ramp initiated: ${transaction.id} for ${request.amount} cNGN`
      );

      return {
        success: true,
        transactionId: transaction.id,
        estimatedTime: "1-3 business days",
      };
    } catch (error) {
      logger.error("Error initiating off-ramp:", error);
      return { success: false, error: "Failed to initiate off-ramp" };
    }
  }

  /**
   * Calculate off-ramp fees
   */
  static calculateOffRampFee(amount: string): {
    amount: number;
    fee: number;
    netAmount: number;
  } {
    const amountNum = parseFloat(amount);
    const feePercent = 0.015; // 1.5% fee
    const minFee = 100; // Minimum 100 NGN fee
    const maxFee = 5000; // Maximum 5000 NGN fee

    let fee = Math.max(minFee, Math.min(maxFee, amountNum * feePercent));
    const netAmount = amountNum - fee;

    return {
      amount: amountNum,
      fee,
      netAmount,
    };
  }

  /**
   * Get supported Nigerian banks
   */
  static async getSupportedBanks(): Promise<
    Array<{
      name: string;
      code: string;
      active: boolean;
    }>
  > {
    return [
      { name: "Access Bank", code: "044", active: true },
      { name: "Guaranty Trust Bank", code: "058", active: true },
      { name: "United Bank for Africa", code: "033", active: true },
      { name: "Zenith Bank", code: "057", active: true },
      { name: "First Bank of Nigeria", code: "011", active: true },
      { name: "Fidelity Bank", code: "070", active: true },
      { name: "Union Bank of Nigeria", code: "032", active: true },
      { name: "Sterling Bank", code: "232", active: true },
      { name: "Stanbic IBTC Bank", code: "221", active: true },
      { name: "Ecobank Nigeria", code: "050", active: true },
      { name: "Wema Bank", code: "035", active: true },
      { name: "FCMB", code: "214", active: true },
      { name: "Kuda Bank", code: "50211", active: true },
      { name: "Opay", code: "999992", active: true },
      { name: "PalmPay", code: "999991", active: true },
    ];
  }
}
