import { prisma } from "@/config/database";
import { NeloContractService } from "../blockchain/neloContractService";
import { CngnService } from "../blockchain/cngnService";
import { BasenameService } from "../blockchain/basenameService";
import { UserService } from "../user/userService";
import { FeeService } from "../payment/feeService";

import { logger } from "@/utils/logger";
import { CONSTANTS, REGEX_PATTERNS } from "@/utils/constants";
import { CONTRACT_ADDRESSES } from "@/config/blockchain";
// Import Prisma enums - these will be available after running prisma generate
type VirtualCardStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";
type TransactionType =
  | "ONRAMP"
  | "OFFRAMP"
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "PAYMENT"
  | "REFUND"
  | "BRIDGE"
  | "TRANSFER";
type TransactionStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export class CardService {
  /**
   * Generate unique card number
   */
  private static generateCardNumber(): string {
    const prefix = CONSTANTS.CARD_NUMBER_PREFIX;
    const remaining = CONSTANTS.CARD_NUMBER_LENGTH - prefix.length;
    const randomPart = Math.random()
      .toString()
      .slice(2, 2 + remaining);
    return prefix + randomPart.padStart(remaining, "0");
  }

  /**
   * Create a new virtual card
   */
  static async createCard(userId: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      // Get user with private key
      const user = await UserService.getUserWithPrivateKey(userId);
      if (!user) {
        return { success: false, error: "User not found" };
      }

      if (!user.isActive) {
        return { success: false, error: "User account is inactive" };
      }

      // Generate unique card number
      let cardNumber: string;
      let attempts = 0;
      do {
        cardNumber = this.generateCardNumber();
        const existing = await prisma.virtualCard.findUnique({
          where: { cardNumber },
        });
        if (!existing) break;
        attempts++;
      } while (attempts < 10);

      if (attempts >= 10) {
        return {
          success: false,
          error: "Failed to generate unique card number",
        };
      }

      // Virtual cards are now database-only records
      // No blockchain transaction needed for card creation
      // The Nelo contract will hold the actual tokens when deposited

      // Save card to database
      const card = await prisma.virtualCard.create({
        data: {
          userId,
          cardNumber,
          tokenId: `card_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 11)}`, // Generate unique ID
          contractAddress: CONTRACT_ADDRESSES.NELO_CUSTODY || "",
          status: "ACTIVE" as VirtualCardStatus,
        },
      });

      // Create transaction record
      await prisma.transaction.create({
        data: {
          userId,
          cardId: card.id,
          type: "DEPOSIT" as TransactionType,
          amount: 0,
          status: "COMPLETED" as TransactionStatus,
          description: "Virtual card created",
          txHash: null, // No blockchain transaction for card creation
        },
      });

      logger.info(`Virtual card created: ${card.id} for user ${userId}`);

      return {
        success: true,
        data: {
          cardId: card.id,
          cardNumber: card.cardNumber,
          tokenId: card.tokenId,
          txHash: null, // No blockchain transaction for card creation
        },
      };
    } catch (error) {
      logger.error("Error creating card:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Card creation failed",
      };
    }
  }

  /**
   * Get user's cards
   */
  static async getUserCards(userId: string): Promise<any[]> {
    try {
      const cards = await prisma.virtualCard.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      return cards;
    } catch (error) {
      logger.error("Error getting user cards:", error);
      return [];
    }
  }

  /**
   * Get card by ID
   */
  static async getCardById(cardId: string): Promise<any | null> {
    try {
      const card = await prisma.virtualCard.findUnique({
        where: { id: cardId },
        include: {
          user: {
            select: {
              id: true,
              whatsappNumber: true,
              walletAddress: true,
              basename: true,
            },
          },
        },
      });

      return card;
    } catch (error) {
      logger.error("Error getting card by ID:", error);
      return null;
    }
  }

  /**
   * Sync card balance from blockchain
   */
  static async syncCardBalance(cardId: string): Promise<boolean> {
    try {
      const card = await prisma.virtualCard.findUnique({
        where: { id: cardId },
      });

      if (!card) {
        logger.error(`Card not found: ${cardId}`);
        return false;
      }

      // Get balance from Nelo custody contract
      const user = await UserService.getUserWithPrivateKey(card.userId);
      if (!user) {
        logger.error(`User not found for card: ${cardId}`);
        return false;
      }

      const blockchainBalance = await NeloContractService.getUserBalance(
        user.walletAddress,
        CONTRACT_ADDRESSES.CNGN_TOKEN || ""
      );

      // Update database
      await prisma.virtualCard.update({
        where: { id: cardId },
        data: { cnmgBalance: blockchainBalance },
      });

      logger.info(`Card balance synced: ${cardId} - ${blockchainBalance} cNGN`);
      return true;
    } catch (error) {
      logger.error("Error syncing card balance:", error);
      return false;
    }
  }

  /**
   * Get total balance for user
   */
  static async getTotalBalance(userId: string): Promise<string> {
    try {
      const cards = await prisma.virtualCard.findMany({
        where: { userId, status: "ACTIVE" as VirtualCardStatus },
        select: { cnmgBalance: true },
      });

      const total = cards.reduce(
        (sum: number, card: any) =>
          sum + parseFloat(card.cnmgBalance.toString()),
        0
      );

      return total.toFixed(8);
    } catch (error) {
      logger.error("Error getting total balance:", error);
      return "0";
    }
  }

  /**
   * Get card count for user
   */
  static async getCardCount(userId: string): Promise<number> {
    try {
      return await prisma.virtualCard.count({
        where: { userId, status: "ACTIVE" as VirtualCardStatus },
      });
    } catch (error) {
      logger.error("Error getting card count:", error);
      return 0;
    }
  }

  /**
   * Send money (transfer cNGN)
   */
  static async sendMoney(
    userId: string,
    amount: string,
    recipient: string
  ): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
  }> {
    try {
      // Validate amount
      if (!CngnService.isValidAmount(amount)) {
        return { success: false, error: "Invalid amount" };
      }

      // Get user with private key
      const user = await UserService.getUserWithPrivateKey(userId);
      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Process recipient (could be address or basename)
      let recipientAddress = recipient;

      if (REGEX_PATTERNS.BASENAME.test(recipient) || recipient.includes(".")) {
        const resolved = await BasenameService.resolveBasename(
          BasenameService.formatBasename(recipient)
        );

        if (!resolved.isValid) {
          return { success: false, error: "Invalid recipient basename" };
        }

        recipientAddress = resolved.address;
      } else if (!REGEX_PATTERNS.ETHEREUM_ADDRESS.test(recipient)) {
        return { success: false, error: "Invalid recipient address" };
      }

      // Calculate fee and check balance
      const feeInfo = FeeService.calculateTransactionFee(amount);
      const balance = await CngnService.getBalance(user.walletAddress);

      if (parseFloat(balance.balance) < feeInfo.originalAmount) {
        return {
          success: false,
          error: `Insufficient balance. Need ${feeInfo.originalAmount} cNGN (including ${feeInfo.feeAmount} cNGN fee)`,
        };
      }

      // Execute transfer with fee collection
      const transferResult = await FeeService.processTransferWithFee(
        user.encryptedPrivateKey,
        recipientAddress,
        amount
      );

      if (!transferResult.success) {
        return {
          success: false,
          error: transferResult.error || "Transfer failed",
        };
      }

      // Create transaction record
      await prisma.transaction.create({
        data: {
          userId,
          type: "TRANSFER" as TransactionType,
          amount: parseFloat(amount),
          status: "COMPLETED" as TransactionStatus,
          description: `Transfer to ${recipient}`,
          txHash: transferResult.txHash,
          metadata: {
            recipient: recipientAddress,
            originalRecipient: recipient,
            feeAmount: feeInfo.feeAmount,
            netAmount: feeInfo.netAmount,
            feeCollected: transferResult.feeCollected || 0,
          },
        },
      });

      logger.info(
        `Transfer completed: ${amount} cNGN from ${user.walletAddress} to ${recipientAddress}`
      );

      return {
        success: true,
        txHash: transferResult.txHash,
      };
    } catch (error) {
      logger.error("Error sending money:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Transfer failed",
      };
    }
  }

  /**
   * Deposit cNGN to card
   */
  static async depositToCard(
    cardId: string,
    amount: string
  ): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
  }> {
    try {
      // Get card with user info
      const card = await prisma.virtualCard.findUnique({
        where: { id: cardId },
        include: {
          user: {
            select: {
              id: true,
              encryptedPrivateKey: true,
              walletAddress: true,
            },
          },
        },
      });

      if (!card) {
        return { success: false, error: "Card not found" };
      }

      if (card.status !== "ACTIVE") {
        return { success: false, error: "Card is not active" };
      }

      // Validate amount
      if (!CngnService.isValidAmount(amount)) {
        return { success: false, error: "Invalid amount" };
      }

      // Check user's cNGN balance
      const balance = await CngnService.getBalance(card.user.walletAddress);
      if (parseFloat(balance.balance) < parseFloat(amount)) {
        return { success: false, error: "Insufficient cNGN balance" };
      }

      // Deposit to Nelo custody contract
      const depositResult = await NeloContractService.depositTokens(
        card.user.encryptedPrivateKey,
        CONTRACT_ADDRESSES.CNGN_TOKEN || "",
        amount
      );

      if (!depositResult.success) {
        return {
          success: false,
          error: depositResult.error || "Deposit failed",
        };
      }

      // Update card balance
      await this.syncCardBalance(cardId);

      // Create transaction record
      await prisma.transaction.create({
        data: {
          userId: card.userId,
          cardId,
          type: "DEPOSIT" as TransactionType,
          amount: parseFloat(amount),
          status: "COMPLETED" as TransactionStatus,
          description: `Deposit to card ${card.cardNumber.slice(-4)}`,
          txHash: depositResult.txHash,
        },
      });

      logger.info(`Deposit completed: ${amount} cNGN to card ${cardId}`);

      return {
        success: true,
        txHash: depositResult.txHash,
      };
    } catch (error) {
      logger.error("Error depositing to card:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Deposit failed",
      };
    }
  }

  /**
   * Get recent transactions for user
   */
  static async getRecentTransactions(
    userId: string,
    limit: number = 10
  ): Promise<any[]> {
    try {
      const transactions = await prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          card: {
            select: {
              cardNumber: true,
            },
          },
        },
      });

      return transactions;
    } catch (error) {
      logger.error("Error getting recent transactions:", error);
      return [];
    }
  }

  /**
   * Get deposit info for user
   */
  static async getDepositInfo(userId: string): Promise<{
    walletAddress: string;
    qrCode?: string;
    onRampUrl?: string;
  }> {
    try {
      const user = await UserService.getUserWithPrivateKey(userId);
      if (!user) {
        throw new Error("User not found");
      }

      return {
        walletAddress: user.walletAddress,
        // QR code and on-ramp URL can be generated here
      };
    } catch (error) {
      logger.error("Error getting deposit info:", error);
      throw error;
    }
  }

  /**
   * Suspend card
   */
  static async suspendCard(cardId: string): Promise<boolean> {
    try {
      await prisma.virtualCard.update({
        where: { id: cardId },
        data: { status: "SUSPENDED" as VirtualCardStatus },
      });

      logger.info(`Card suspended: ${cardId}`);
      return true;
    } catch (error) {
      logger.error("Error suspending card:", error);
      return false;
    }
  }

  /**
   * Activate card
   */
  static async activateCard(cardId: string): Promise<boolean> {
    try {
      await prisma.virtualCard.update({
        where: { id: cardId },
        data: { status: "ACTIVE" as VirtualCardStatus },
      });

      logger.info(`Card activated: ${cardId}`);
      return true;
    } catch (error) {
      logger.error("Error activating card:", error);
      return false;
    }
  }
}
