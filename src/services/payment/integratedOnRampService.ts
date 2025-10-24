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

export interface OnRampDepositRequest {
  userId: string;
  amountNGN: number;
  paymentMethod: "BANK_TRANSFER" | "CARD" | "USSD";
}

/**
 * Integrated OnRamp Service - Converts NGN to cNGN
 * This service handles the complete flow from fiat payment to blockchain deposit
 */
export class IntegratedOnRampService {
  /**
   * Initiate NGN to cNGN conversion
   * 1. User deposits NGN via Flutterwave
   * 2. Backend receives confirmation
   * 3. Backend deposits cNGN to user's wallet via Nelo contract
   */
  static async depositNGN(request: OnRampDepositRequest): Promise<{
    success: boolean;
    paymentReference?: string;
    paymentInstructions?: string;
    error?: string;
  }> {
    try {
      const { userId, amountNGN, paymentMethod } = request;

      // Get user
      const user = await UserService.getUserById(userId);
      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Validate amount
      if (amountNGN < 100) {
        return { success: false, error: "Minimum deposit is ₦100" };
      }

      if (amountNGN > 1000000) {
        return { success: false, error: "Maximum deposit is ₦1,000,000" };
      }

      // Use MockFiatService for demo (in production, use real Flutterwave)
      const mockResult = await MockFiatService.initiateFiatToCNGN({
        userId,
        amount: amountNGN,
        paymentMethod,
        virtualAccountNumber: user.virtualAccountNumber || undefined,
      });

      if (!mockResult.success) {
        return {
          success: false,
          error: mockResult.error || "Failed to initiate payment",
        };
      }

      logger.info(
        `OnRamp deposit initiated: ${mockResult.paymentReference} for user ${userId}`
      );

      return {
        success: true,
        paymentReference: mockResult.paymentReference,
        paymentInstructions: mockResult.paymentInstructions,
      };
    } catch (error) {
      logger.error("Error in OnRamp deposit:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "OnRamp deposit failed",
      };
    }
  }

  /**
   * Confirm NGN payment and mint cNGN
   * Called when Flutterwave webhook confirms payment
   */
  static async confirmPaymentAndMintCNGN(paymentReference: string): Promise<{
    success: boolean;
    txHash?: string;
    cngnAmount?: number;
    error?: string;
  }> {
    try {
      // Find the pending transaction
      const transaction = await prisma.transaction.findFirst({
        where: {
          metadata: {
            path: ["paymentReference"],
            equals: paymentReference,
          },
          status: "PENDING",
        },
        include: {
          user: true,
        },
      });

      if (!transaction) {
        return {
          success: false,
          error: "Payment reference not found or already processed",
        };
      }

      const user = transaction.user;
      const amountNGN = Number(transaction.amount);
      const amountCNGN = amountNGN; // 1:1 conversion for demo

      // Step 1: Deposit cNGN to Nelo custody contract
      let depositResult;
      try {
        // In production, you would use the deployer wallet to deposit cNGN
        // For demo, we'll simulate this
        const amountWei = ethers.parseUnits(
          amountCNGN.toString(),
          CONSTANTS.CNGN_DECIMALS
        );

        // Mock successful blockchain deposit
        depositResult = {
          success: true,
          txHash: `0x${Math.random().toString(16).substring(2, 66)}`,
          gasUsed: "21000",
        };

        logger.info(
          `Mock cNGN deposit: ${amountCNGN} cNGN to ${user.walletAddress}`
        );
      } catch (blockchainError) {
        logger.error("Blockchain deposit failed:", blockchainError);
        return {
          success: false,
          error: "Blockchain deposit failed",
        };
      }

      // Step 2: Update transaction status
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "COMPLETED",
          txHash: depositResult.txHash,
          currency: "CNGN",
          metadata: {
            ...(transaction.metadata as any),
            completedAt: new Date().toISOString(),
            txHash: depositResult.txHash,
            cngnMinted: amountCNGN,
            gasUsed: depositResult.gasUsed,
          },
        },
      });

      // Step 3: Send WhatsApp notification
      try {
        const { WhatsAppService } = await import(
          "@/services/whatsapp/whatsappService"
        );
        const whatsappService = new WhatsAppService();

        const message =
          `✅ *Deposit Successful!*\n\n` +
          `Amount: ₦${amountNGN.toLocaleString()}\n` +
          `Received: ${amountCNGN.toLocaleString()} cNGN\n` +
          `Transaction: ${depositResult.txHash.slice(0, 10)}...\n\n` +
          `Your cNGN is now available in your wallet! 🎉\n\n` +
          `Type "balance" to check your balance.`;

        await whatsappService.sendMessage(user.whatsappNumber, message);
      } catch (notificationError) {
        logger.error("Failed to send deposit notification:", notificationError);
      }

      logger.info(
        `OnRamp completed: ${paymentReference}, minted ${amountCNGN} cNGN`
      );

      return {
        success: true,
        txHash: depositResult.txHash,
        cngnAmount: amountCNGN,
      };
    } catch (error) {
      logger.error("Error confirming payment and minting cNGN:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to confirm payment",
      };
    }
  }

  /**
   * Get exchange rate (NGN to cNGN)
   */
  static getExchangeRate(): {
    rate: number;
    fee: number;
    minimum: number;
    maximum: number;
  } {
    return {
      rate: 1, // 1 NGN = 1 cNGN
      fee: 0, // No fee for deposits in demo
      minimum: 100, // ₦100 minimum
      maximum: 1000000, // ₦1M maximum
    };
  }

  /**
   * Calculate deposit amounts
   */
  static calculateDeposit(amountNGN: number): {
    inputAmount: number;
    outputAmount: number;
    fee: number;
    netAmount: number;
  } {
    const rates = this.getExchangeRate();

    return {
      inputAmount: amountNGN,
      outputAmount: amountNGN * rates.rate,
      fee: 0, // No fee for deposits
      netAmount: amountNGN * rates.rate,
    };
  }

  /**
   * Confirm payment manually (for "paid 10000" command)
   */
  static async confirmPayment(request: {
    userId: string;
    amountNGN: number;
    paymentReference: string;
  }): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
  }> {
    try {
      const { userId, amountNGN, paymentReference } = request;

      // Get user
      const user = await UserService.getUserById(userId);
      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Create transaction record
      const transaction = await prisma.transaction.create({
        data: {
          userId,
          type: "DEPOSIT",
          amount: amountNGN,
          currency: "NGN",
          status: "PENDING",
          description: `Manual payment confirmation: ₦${amountNGN}`,
          metadata: {
            paymentReference,
            paymentMethod: "BANK_TRANSFER",
            manualConfirmation: true,
            confirmedAt: new Date().toISOString(),
          },
        },
      });

      // Process the payment confirmation
      const result = await this.confirmPaymentAndMintCNGN(paymentReference);

      if (result.success) {
        return {
          success: true,
          txHash: result.txHash,
        };
      } else {
        // Update transaction as failed
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: "FAILED" },
        });

        return {
          success: false,
          error: result.error || "Payment confirmation failed",
        };
      }
    } catch (error) {
      logger.error("Error confirming manual payment:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Payment confirmation failed",
      };
    }
  }

  /**
   * Get deposit limits for user based on KYC level
   */
  static async getDepositLimits(userId: string): Promise<{
    daily: number;
    monthly: number;
    minimum: number;
    maximum: number;
  }> {
    try {
      const user = await UserService.getUserById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Base limits
      let limits = {
        daily: 50000, // ₦50K per day
        monthly: 500000, // ₦500K per month
        minimum: 100, // ₦100 minimum
        maximum: 10000, // ₦10K maximum per transaction
      };

      // Adjust based on KYC level
      switch (user.kycLevel) {
        case "BASIC":
          limits.daily = 100000; // ₦100K
          limits.monthly = 1000000; // ₦1M
          limits.maximum = 50000; // ₦50K
          break;
        case "VERIFIED":
          limits.daily = 500000; // ₦500K
          limits.monthly = 5000000; // ₦5M
          limits.maximum = 200000; // ₦200K
          break;
        case "PREMIUM":
          limits.daily = 2000000; // ₦2M
          limits.monthly = 20000000; // ₦20M
          limits.maximum = 1000000; // ₦1M
          break;
      }

      return limits;
    } catch (error) {
      logger.error("Error getting deposit limits:", error);
      // Return default limits
      return {
        daily: 50000,
        monthly: 500000,
        minimum: 100,
        maximum: 10000,
      };
    }
  }
}
