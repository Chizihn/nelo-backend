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

      // In a real implementation, you would:
      // 1. Transfer cNGN to your treasury wallet
      // 2. Initiate bank transfer via banking API
      // 3. Update transaction status based on bank response

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
   * Get off-ramp transaction status
   */
  static async getOffRampStatus(transactionId: string): Promise<{
    success: boolean;
    status?: string;
    amount?: string;
    bankAccount?: any;
    error?: string;
  }> {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          user: {
            select: {
              whatsappNumber: true,
            },
          },
        },
      });

      if (!transaction) {
        return { success: false, error: "Transaction not found" };
      }

      const metadata = transaction.metadata as any;
      return {
        success: true,
        status: transaction.status,
        amount: transaction.amount.toString(),
        bankAccount: metadata?.bankAccount,
      };
    } catch (error) {
      logger.error("Error getting off-ramp status:", error);
      return { success: false, error: "Failed to get transaction status" };
    }
  }

  /**
   * Process off-ramp completion (called by banking webhook)
   */
  static async completeOffRamp(
    transactionId: string,
    bankTransactionId: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Update transaction status
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: "COMPLETED",
          metadata: {
            bankTransactionId,
            completedAt: new Date().toISOString(),
          },
        },
        include: {
          user: true,
        },
      });

      // TODO: Send WhatsApp notification to user
      logger.info(
        `Off-ramp completed: ${transactionId} - Bank TX: ${bankTransactionId}`
      );

      return { success: true };
    } catch (error) {
      logger.error("Error completing off-ramp:", error);
      return { success: false, error: "Failed to complete off-ramp" };
    }
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
    // Nigerian bank codes (partial list)
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

  /**
   * Validate Nigerian bank account
   */
  static async validateBankAccount(
    accountNumber: string,
    _bankCode: string
  ): Promise<{
    valid: boolean;
    accountName?: string;
    error?: string;
  }> {
    try {
      // In a real implementation, you would call a bank verification API
      // like Paystack, Flutterwave, or direct bank APIs

      // Mock validation for demo
      if (accountNumber.length !== 10) {
        return { valid: false, error: "Account number must be 10 digits" };
      }

      if (!/^\d+$/.test(accountNumber)) {
        return {
          valid: false,
          error: "Account number must contain only digits",
        };
      }

      // Mock successful validation
      return {
        valid: true,
        accountName: "JOHN DOE", // Would come from bank API
      };
    } catch (error) {
      logger.error("Error validating bank account:", error);
      return { valid: false, error: "Failed to validate bank account" };
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
   * Get off-ramp limits
   */
  static getOffRampLimits(): {
    daily: number;
    monthly: number;
    minimum: number;
    maximum: number;
  } {
    return {
      daily: 1000000, // 1M NGN per day
      monthly: 10000000, // 10M NGN per month
      minimum: 1000, // 1K NGN minimum
      maximum: 5000000, // 5M NGN maximum per transaction
    };
  }
}
