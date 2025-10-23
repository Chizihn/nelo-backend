import { prisma } from "@/config/database";
import { NeloContractService } from "../blockchain/neloContractService";
import { CngnService } from "../blockchain/cngnService";
import { UserService } from "../user/userService";
import { flutterwaveService } from "./flutterwaveService";
import { MockFiatService } from "./mockFiatService";
import { logger } from "@/utils/logger";
import { CONTRACT_ADDRESSES } from "@/config/blockchain";
import { CONSTANTS } from "@/utils/constants";
import { ethers } from "ethers";

export interface OffRampWithdrawalRequest {
  userId: string;
  amountCNGN: number;
  bankAccountId: string;
}

/**
 * Integrated OffRamp Service - Converts cNGN to NGN
 * This service handles the complete flow from blockchain withdrawal to fiat payment
 */
export class IntegratedOffRampService {
  /**
   * Initiate cNGN to NGN conversion
   * 1. User requests withdrawal
   * 2. Backend withdraws cNGN from user's wallet
   * 3. Backend sends NGN via Flutterwave
   */
  static async withdrawCNGN(request: OffRampWithdrawalRequest): Promise<{
    success: boolean;
    withdrawalReference?: string;
    estimatedTime?: string;
    netAmount?: number;
    error?: string;
  }> {
    try {
      const { userId, amountCNGN, bankAccountId } = request;

      // Get user
      const user = await UserService.getUserById(userId);
      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Get bank account
      const bankAccount = await prisma.bankAccount.findFirst({
        where: {
          id: bankAccountId,
          userId,
          isActive: true,
        },
      });

      if (!bankAccount) {
        return { success: false, error: "Bank account not found" };
      }

      // Validate amount
      const limits = this.getWithdrawalLimits();
      if (amountCNGN < limits.minimum) {
        return {
          success: false,
          error: `Minimum withdrawal is ${limits.minimum} cNGN`,
        };
      }

      if (amountCNGN > limits.maximum) {
        return {
          success: false,
          error: `Maximum withdrawal is ${limits.maximum.toLocaleString()} cNGN`,
        };
      }

      // Check cNGN balance (mock for demo)
      try {
        // In production, check actual blockchain balance
        const balance = await CngnService.getBalance(user.walletAddress);
        const balanceNum = parseFloat(balance.balance);

        if (balanceNum < amountCNGN) {
          return {
            success: false,
            error: `Insufficient balance. You have ${balanceNum} cNGN`,
          };
        }
      } catch (balanceError) {
        logger.warn("Could not check balance, proceeding with mock balance");
      }

      // Calculate fees and net amount
      const feeCalculation = this.calculateWithdrawalFee(amountCNGN);

      // Generate withdrawal reference
      const withdrawalReference = `nelo_withdraw_${userId}_${Date.now()}`;

      // Step 1: Create withdrawal transaction record
      const transaction = await prisma.transaction.create({
        data: {
          userId,
          type: "OFFRAMP",
          amount: amountCNGN,
          currency: "CNGN",
          status: "PROCESSING",
          description: `Withdraw ${amountCNGN.toLocaleString()} cNGN to ${
            bankAccount.bankName
          }`,
          metadata: {
            withdrawalReference,
            bankAccountId,
            bankAccount: {
              accountNumber: bankAccount.accountNumber,
              bankName: bankAccount.bankName,
              accountName: bankAccount.accountName,
              bankCode: bankAccount.bankCode,
            },
            feeCalculation,
            conversionRate: 1, // 1 cNGN = 1 NGN
            expectedNGN: feeCalculation.netAmount,
          },
        },
      });

      // Step 2: Withdraw cNGN from user's wallet (mock for demo)
      try {
        // In production, you would:
        // 1. Use user's private key to transfer cNGN to treasury wallet
        // 2. Or use Nelo custody contract to withdraw

        const amountWei = ethers.parseUnits(
          amountCNGN.toString(),
          CONSTANTS.CNGN_DECIMALS
        );

        // Mock successful blockchain withdrawal
        const withdrawResult = {
          success: true,
          txHash: `0x${Math.random().toString(16).substring(2, 66)}`,
          gasUsed: "21000",
        };

        logger.info(
          `Mock cNGN withdrawal: ${amountCNGN} cNGN from ${user.walletAddress}`
        );

        // Update transaction with blockchain details
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            txHash: withdrawResult.txHash,
            metadata: {
              ...(transaction.metadata as any),
              blockchainWithdrawal: {
                txHash: withdrawResult.txHash,
                gasUsed: withdrawResult.gasUsed,
                completedAt: new Date().toISOString(),
              },
            },
          },
        });
      } catch (blockchainError) {
        logger.error("Blockchain withdrawal failed:", blockchainError);

        // Mark transaction as failed
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "FAILED",
            metadata: {
              ...(transaction.metadata as any),
              error: "Blockchain withdrawal failed",
            },
          },
        });

        return {
          success: false,
          error: "Blockchain withdrawal failed",
        };
      }

      // Step 3: Initiate bank transfer (mock for demo)
      try {
        // In production, use real Flutterwave transfer
        // For demo, use MockFiatService
        const mockResult = await MockFiatService.initiateCNGNToFiat({
          userId,
          amount: amountCNGN,
          bankAccountId,
        });

        if (!mockResult.success) {
          throw new Error(mockResult.error || "Bank transfer failed");
        }

        // Update transaction status
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            metadata: {
              ...(transaction.metadata as any),
              bankTransfer: {
                reference: mockResult.withdrawalReference,
                initiatedAt: new Date().toISOString(),
              },
            },
          },
        });

        logger.info(
          `OffRamp withdrawal initiated: ${withdrawalReference} for user ${userId}`
        );

        // Send WhatsApp notification
        try {
          const { WhatsAppService } = await import(
            "@/services/whatsapp/whatsappService"
          );
          const whatsappService = new WhatsAppService();

          const message =
            `⏳ *Withdrawal Processing*\n\n` +
            `Amount: ${amountCNGN.toLocaleString()} cNGN\n` +
            `Fee: ${feeCalculation.fee.toLocaleString()} NGN\n` +
            `You'll receive: ₦${feeCalculation.netAmount.toLocaleString()}\n` +
            `Bank: ${bankAccount.bankName}\n` +
            `Account: ${bankAccount.accountNumber}\n\n` +
            `Estimated time: 1-3 business days\n` +
            `Reference: ${withdrawalReference}`;

          await whatsappService.sendMessage(user.whatsappNumber, message);
        } catch (notificationError) {
          logger.error(
            "Failed to send withdrawal notification:",
            notificationError
          );
        }

        return {
          success: true,
          withdrawalReference,
          estimatedTime: "1-3 business days",
          netAmount: feeCalculation.netAmount,
        };
      } catch (bankTransferError) {
        logger.error("Bank transfer failed:", bankTransferError);

        // Mark transaction as failed
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "FAILED",
            metadata: {
              ...(transaction.metadata as any),
              error: "Bank transfer failed",
            },
          },
        });

        // In production, you would refund the cNGN to user's wallet here

        return {
          success: false,
          error: "Bank transfer failed",
        };
      }
    } catch (error) {
      logger.error("Error in OffRamp withdrawal:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Withdrawal failed",
      };
    }
  }

  /**
   * Complete withdrawal (called by banking webhook or manual process)
   */
  static async completeWithdrawal(withdrawalReference: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const transaction = await prisma.transaction.findFirst({
        where: {
          metadata: {
            path: ["withdrawalReference"],
            equals: withdrawalReference,
          },
          status: "PROCESSING",
        },
        include: {
          user: true,
        },
      });

      if (!transaction) {
        return {
          success: false,
          error: "Withdrawal transaction not found",
        };
      }

      // Update transaction status
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "COMPLETED",
          metadata: {
            ...(transaction.metadata as any),
            completedAt: new Date().toISOString(),
            bankTransferCompleted: true,
          },
        },
      });

      // Send completion notification
      try {
        const { WhatsAppService } = await import(
          "@/services/whatsapp/whatsappService"
        );
        const whatsappService = new WhatsAppService();

        const metadata = transaction.metadata as any;
        const message =
          `✅ *Withdrawal Completed*\n\n` +
          `Amount: ${transaction.amount.toLocaleString()} cNGN\n` +
          `Received: ₦${metadata.feeCalculation.netAmount.toLocaleString()}\n` +
          `Bank: ${metadata.bankAccount.bankName}\n` +
          `Account: ${metadata.bankAccount.accountNumber}\n` +
          `Reference: ${withdrawalReference}\n\n` +
          `Your money has been sent to your bank account! 🎉`;

        await whatsappService.sendMessage(
          transaction.user.whatsappNumber,
          message
        );
      } catch (notificationError) {
        logger.error(
          "Failed to send completion notification:",
          notificationError
        );
      }

      logger.info(`OffRamp withdrawal completed: ${withdrawalReference}`);

      return { success: true };
    } catch (error) {
      logger.error("Error completing withdrawal:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to complete withdrawal",
      };
    }
  }

  /**
   * Calculate withdrawal fee
   */
  static calculateWithdrawalFee(amountCNGN: number): {
    amount: number;
    fee: number;
    netAmount: number;
    feePercentage: number;
  } {
    const feePercentage = 0.015; // 1.5% fee
    const minFee = 100; // Minimum ₦100 fee
    const maxFee = 5000; // Maximum ₦5,000 fee

    let fee = Math.max(minFee, Math.min(maxFee, amountCNGN * feePercentage));
    const netAmount = amountCNGN - fee;

    return {
      amount: amountCNGN,
      fee,
      netAmount,
      feePercentage,
    };
  }

  /**
   * Get withdrawal limits
   */
  static getWithdrawalLimits(): {
    daily: number;
    monthly: number;
    minimum: number;
    maximum: number;
  } {
    return {
      daily: 1000000, // 1M cNGN per day
      monthly: 10000000, // 10M cNGN per month
      minimum: 1000, // 1K cNGN minimum
      maximum: 5000000, // 5M cNGN maximum per transaction
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

  /**
   * Validate bank account
   */
  static async validateBankAccount(
    accountNumber: string,
    bankCode: string
  ): Promise<{
    valid: boolean;
    accountName?: string;
    error?: string;
  }> {
    try {
      // Basic validation
      if (accountNumber.length !== 10) {
        return { valid: false, error: "Account number must be 10 digits" };
      }

      if (!/^\d+$/.test(accountNumber)) {
        return {
          valid: false,
          error: "Account number must contain only digits",
        };
      }

      // In production, call bank verification API
      // For demo, return mock validation
      return {
        valid: true,
        accountName: "JOHN DOE", // Would come from bank API
      };
    } catch (error) {
      logger.error("Error validating bank account:", error);
      return { valid: false, error: "Failed to validate bank account" };
    }
  }
}
