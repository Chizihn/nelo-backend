import { prisma } from "@/config/database";
import { NeloContractService } from "../blockchain/neloContractService";
import { CONTRACT_ADDRESSES } from "@/config/blockchain";
import { logger } from "@/utils/logger";
import { TransactionStatus, TransactionType } from "@prisma/client";

export interface FiatOnRampRequest {
  userId: string;
  amount: number; // NGN amount
  paymentMethod: "BANK_TRANSFER" | "CARD" | "USSD";
  virtualAccountNumber?: string;
}

export interface FiatOffRampRequest {
  userId: string;
  amount: number; // cNGN amount
  bankAccountId: string;
}

export class MockFiatService {
  /**
   * Initiate fiat to cNGN conversion (on-ramp)
   */
  static async initiateFiatToCNGN(request: FiatOnRampRequest): Promise<{
    success: boolean;
    paymentReference?: string;
    paymentInstructions?: string;
    error?: string;
  }> {
    try {
      const { userId, amount, paymentMethod, virtualAccountNumber } = request;

      // Generate payment reference
      const paymentReference = `nelo_deposit_${userId}_${Date.now()}`;

      // Create pending transaction
      await prisma.transaction.create({
        data: {
          userId,
          type: "ONRAMP" as TransactionType,
          amount: amount,
          currency: "NGN",
          status: "PENDING" as TransactionStatus,
          description: `Fiat to cNGN conversion - ₦${amount.toLocaleString()}`,
          metadata: {
            paymentReference,
            paymentMethod,
            virtualAccountNumber,
            conversionRate: 1, // 1 NGN = 1 cNGN for demo
            expectedCNGN: amount,
            mock: true,
          },
        },
      });

      let paymentInstructions = "";

      switch (paymentMethod) {
        case "BANK_TRANSFER":
          paymentInstructions = virtualAccountNumber
            ? `Transfer ₦${amount.toLocaleString()} to:\n\nAccount: ${virtualAccountNumber}\nBank: Wema Bank\nName: Your Nelo Account\n\nReference: ${paymentReference}`
            : `Bank transfer initiated for ₦${amount.toLocaleString()}`;
          break;
        case "CARD":
          paymentInstructions = `Card payment of ₦${amount.toLocaleString()} initiated.\nReference: ${paymentReference}`;
          break;
        case "USSD":
          paymentInstructions = `Dial *737*000*${amount}# to complete payment.\nReference: ${paymentReference}`;
          break;
      }

      logger.info(
        `Fiat on-ramp initiated: ${paymentReference} for user ${userId}`
      );

      return {
        success: true,
        paymentReference,
        paymentInstructions,
      };
    } catch (error) {
      logger.error("Error initiating fiat on-ramp:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to initiate payment",
      };
    }
  }

  /**
   * Simulate payment confirmation and mint cNGN
   */
  static async confirmFiatPayment(paymentReference: string): Promise<{
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

      const metadata = transaction.metadata as any;
      const cngnAmount = metadata.expectedCNGN || transaction.amount;

      // For demo, simulate minting cNGN by depositing to Nelo contract
      // In production, this would involve actual cNGN token minting
      let txHash = null;

      try {
        // Mock blockchain transaction
        txHash = `0x${Math.random().toString(16).substring(2, 66)}`;

        // In a real implementation, you would:
        // 1. Mint cNGN tokens to user's wallet
        // 2. Or deposit pre-minted cNGN to Nelo custody contract

        logger.info(
          `Mock cNGN minting: ${cngnAmount} cNGN for user ${transaction.userId}`
        );
      } catch (blockchainError) {
        logger.error("Blockchain transaction failed:", blockchainError);
        // Continue with mock success for demo
        txHash = `0x${"mock".repeat(16)}`;
      }

      // Update transaction status
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "COMPLETED" as TransactionStatus,
          txHash,
          currency: "CNGN",
          metadata: {
            ...metadata,
            completedAt: new Date().toISOString(),
            txHash,
            cngnMinted: cngnAmount,
          },
        },
      });

      logger.info(
        `Fiat payment confirmed: ${paymentReference}, minted ${cngnAmount} cNGN`
      );

      return {
        success: true,
        txHash,
        cngnAmount,
      };
    } catch (error) {
      logger.error("Error confirming fiat payment:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to confirm payment",
      };
    }
  }

  /**
   * Initiate cNGN to fiat conversion (off-ramp)
   */
  static async initiateCNGNToFiat(request: FiatOffRampRequest): Promise<{
    success: boolean;
    withdrawalReference?: string;
    estimatedTime?: string;
    error?: string;
  }> {
    try {
      const { userId, amount, bankAccountId } = request;

      // Get user's bank account
      const bankAccount = await prisma.bankAccount.findFirst({
        where: {
          id: bankAccountId,
          userId,
          isActive: true,
        },
      });

      if (!bankAccount) {
        return {
          success: false,
          error: "Bank account not found",
        };
      }

      // Check user's cNGN balance (mock check)
      // In production, check actual blockchain balance
      const mockBalance = 100000; // Mock balance for demo

      if (amount > mockBalance) {
        return {
          success: false,
          error: "Insufficient cNGN balance",
        };
      }

      // Generate withdrawal reference
      const withdrawalReference = `nelo_withdraw_${userId}_${Date.now()}`;

      // Calculate fees (1.5% for demo)
      const feePercentage = 0.015;
      const fee = amount * feePercentage;
      const netAmount = amount - fee;

      // Create withdrawal transaction
      await prisma.transaction.create({
        data: {
          userId,
          type: "OFFRAMP" as TransactionType,
          amount: amount,
          currency: "CNGN",
          status: "PROCESSING" as TransactionStatus,
          description: `cNGN to Fiat withdrawal - ${amount.toLocaleString()} cNGN`,
          metadata: {
            withdrawalReference,
            bankAccountId,
            bankAccount: {
              accountNumber: bankAccount.accountNumber,
              bankName: bankAccount.bankName,
              accountName: bankAccount.accountName,
            },
            conversionRate: 1, // 1 cNGN = 1 NGN for demo
            feeAmount: fee,
            netAmount: netAmount,
            expectedNGN: netAmount,
            mock: true,
          },
        },
      });

      // Simulate processing time
      setTimeout(async () => {
        try {
          await this.completeWithdrawal(withdrawalReference);
        } catch (error) {
          logger.error("Error completing mock withdrawal:", error);
        }
      }, 5000); // Complete after 5 seconds for demo

      logger.info(
        `cNGN off-ramp initiated: ${withdrawalReference} for user ${userId}`
      );

      return {
        success: true,
        withdrawalReference,
        estimatedTime: "1-3 business days",
      };
    } catch (error) {
      logger.error("Error initiating cNGN off-ramp:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to initiate withdrawal",
      };
    }
  }

  /**
   * Complete withdrawal (mock)
   */
  private static async completeWithdrawal(
    withdrawalReference: string
  ): Promise<void> {
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
        logger.error(
          `Withdrawal transaction not found: ${withdrawalReference}`
        );
        return;
      }

      // Mock successful completion
      const txHash = `0x${Math.random().toString(16).substring(2, 66)}`;

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "COMPLETED" as TransactionStatus,
          txHash,
          metadata: {
            ...(transaction.metadata as any),
            completedAt: new Date().toISOString(),
            txHash,
            bankTransferCompleted: true,
          },
        },
      });

      // Send WhatsApp notification
      try {
        const { WhatsAppService } = await import(
          "@/services/whatsapp/whatsappService"
        );
        const whatsappService = new WhatsAppService();

        const metadata = transaction.metadata as any;
        const message =
          `✅ *Withdrawal Completed*\n\n` +
          `Amount: ${transaction.amount.toLocaleString()} cNGN\n` +
          `Received: ₦${metadata.netAmount.toLocaleString()}\n` +
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
          "Failed to send withdrawal notification:",
          notificationError
        );
      }

      logger.info(`Mock withdrawal completed: ${withdrawalReference}`);
    } catch (error) {
      logger.error("Error completing withdrawal:", error);
    }
  }

  /**
   * Get exchange rate (mock)
   */
  static getExchangeRate(): {
    ngnToCngn: number;
    cngnToNgn: number;
    fee: number;
  } {
    return {
      ngnToCngn: 1, // 1 NGN = 1 cNGN
      cngnToNgn: 1, // 1 cNGN = 1 NGN
      fee: 0.015, // 1.5% fee
    };
  }

  /**
   * Calculate conversion amounts
   */
  static calculateConversion(
    amount: number,
    direction: "NGN_TO_CNGN" | "CNGN_TO_NGN"
  ): {
    inputAmount: number;
    outputAmount: number;
    fee: number;
    netAmount: number;
  } {
    const rates = this.getExchangeRate();

    if (direction === "NGN_TO_CNGN") {
      // No fee for on-ramp in demo
      return {
        inputAmount: amount,
        outputAmount: amount * rates.ngnToCngn,
        fee: 0,
        netAmount: amount * rates.ngnToCngn,
      };
    } else {
      // Fee for off-ramp
      const fee = amount * rates.fee;
      const netAmount = (amount - fee) * rates.cngnToNgn;

      return {
        inputAmount: amount,
        outputAmount: netAmount,
        fee: fee,
        netAmount: netAmount,
      };
    }
  }
}
