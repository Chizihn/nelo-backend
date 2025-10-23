import { prisma } from "@/config/database";
import { NeloContractService } from "../blockchain/neloContractService";
import { CngnService } from "../blockchain/cngnService";
import { BasenameService } from "../blockchain/basenameService";
import { UserService } from "../user/userService";
import { FeeService } from "../payment/feeService";
import { MockCardService } from "./mockCardService";

import { logger } from "@/utils/logger";
import { CONSTANTS, REGEX_PATTERNS } from "@/utils/constants";
import { CONTRACT_ADDRESSES } from "@/config/blockchain";
import {
  TransactionStatus,
  TransactionType,
  VirtualCardStatus,
} from "@prisma/client";

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
   * Create a new MOCK virtual card with REAL blockchain integration
   */
  static async createCard(userId: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      // Check KYC status first
      const { KYCService } = await import("../kyc/kycService");
      const kycPermission = await KYCService.canPerformAction(
        userId,
        "CREATE_CARD"
      );

      if (!kycPermission.allowed) {
        return {
          success: false,
          error: `KYC verification required: ${kycPermission.reason}`,
        };
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return { success: false, error: "User not found" };
      }

      if (!user.isActive) {
        return { success: false, error: "User account is inactive" };
      }

      // Step 1: Create MOCK virtual card (NO Sudo Africa)
      const mockCard = MockCardService.createMockCard(userId);

      // Step 2: Generate unique card number for display
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

      // Step 3: Save MOCK card to database (NO Sudo Africa fields)
      const card = await prisma.virtualCard.create({
        data: {
          userId,
          cardNumber,
          tokenId: `card_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 11)}`,
          contractAddress: CONTRACT_ADDRESSES.NELO_CUSTODY || "",
          status: "ACTIVE" as VirtualCardStatus,
          // NO sudoCardId or sudoCustomerId - completely removed
          metadata: {
            mockCard: true,
            cardData: JSON.parse(JSON.stringify(mockCard)),
            maskedPan: mockCard.maskedPan,
            expiryMonth: mockCard.expiryMonth,
            expiryYear: mockCard.expiryYear,
            brand: mockCard.brand,
            currency: mockCard.currency,
            cvv: mockCard.cvv,
          },
        },
      });

      // Step 4: Create transaction record for card creation
      await prisma.transaction.create({
        data: {
          userId,
          cardId: card.id,
          type: "DEPOSIT" as TransactionType,
          amount: 0,
          status: "COMPLETED" as TransactionStatus,
          description: "Mock virtual card created for hackathon demo",
          metadata: {
            mockCardId: mockCard.id,
            cardCreation: true,
            mockTransaction: true,
          },
        },
      });

      logger.info(
        `Mock virtual card created: ${card.id} for user ${userId}, Mock ID: ${mockCard.id}`
      );

      return {
        success: true,
        data: {
          cardId: card.id,
          cardNumber: card.cardNumber,
          tokenId: card.tokenId,
          mockCardId: mockCard.id,
          maskedPan: mockCard.maskedPan,
          expiryMonth: mockCard.expiryMonth,
          expiryYear: mockCard.expiryYear,
          cvv: mockCard.cvv, // Only returned on creation
          brand: mockCard.brand,
          currency: mockCard.currency,
        },
      };
    } catch (error) {
      logger.error("Error creating mock virtual card:", error);
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
   * Get card by ID (NO Sudo Africa)
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
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!card) return null;

      // Get mock card data from metadata
      const mockData = (card.metadata as any)?.cardData || null;

      return {
        ...card,
        mockData,
      };
    } catch (error) {
      logger.error("Error getting card by ID:", error);
      return null;
    }
  }

  /**
   * Get card transactions (mock + real blockchain)
   */
  static async getCardTransactions(
    cardId: string,
    limit: number = 10
  ): Promise<any[]> {
    try {
      const card = await prisma.virtualCard.findUnique({
        where: { id: cardId },
      });

      if (!card) return [];

      // Get local transactions
      const localTransactions = await prisma.transaction.findMany({
        where: { cardId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      // Get mock transactions for demo
      const mockTransactions = MockCardService.getMockTransactions(cardId);

      // Merge and sort transactions
      const allTransactions = [
        ...localTransactions.map((tx) => ({
          ...tx,
          source: "local",
          displayAmount: tx.amount,
          displayCurrency: tx.currency,
        })),
        ...mockTransactions.map((tx) => ({
          id: tx.id,
          type: tx.type.toUpperCase(),
          amount: tx.amount,
          currency: "NGN",
          status: tx.status.toUpperCase(),
          description: `${tx.merchant || "Mock Transaction"} - ${tx.type}`,
          createdAt: new Date(tx.timestamp),
          source: "mock",
          displayAmount: tx.amount,
          displayCurrency: "NGN",
          merchant: tx.merchant,
          mockData: tx,
        })),
      ];

      // Sort by date and return limited results
      return allTransactions
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, limit);
    } catch (error) {
      logger.error("Error getting card transactions:", error);
      return [];
    }
  }

  /**
   * Sync card balance from REAL blockchain (NO Sudo Africa)
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

      // Get balance from Nelo custody contract (REAL blockchain)
      const user = await prisma.user.findUnique({
        where: { id: card.userId },
      });

      if (!user) {
        logger.error(`User not found for card: ${cardId}`);
        return false;
      }

      const blockchainBalance = await NeloContractService.getUserBalance(
        user.walletAddress,
        CONTRACT_ADDRESSES.CNGN_TOKEN || ""
      );

      // Update database with REAL blockchain balance
      await prisma.virtualCard.update({
        where: { id: cardId },
        data: {
          cnmgBalance: blockchainBalance,
          metadata: {
            ...((card.metadata as object) || {}),
            lastSyncAt: new Date().toISOString(),
            blockchainBalance: blockchainBalance,
          },
        },
      });

      logger.info(
        `Card balance synced from REAL blockchain: ${cardId} - ${blockchainBalance} cNGN`
      );
      return true;
    } catch (error) {
      logger.error("Error syncing card balance:", error);
      return false;
    }
  }

  /**
   * Get total balance for user from REAL blockchain
   */
  static async getTotalBalance(userId: string): Promise<string> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return "0";
      }

      // Get REAL balance from blockchain
      const balance = await CngnService.getBalance(user.walletAddress);
      return balance.balance;
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
   * Send money (REAL blockchain transaction)
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

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

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

      // Execute REAL transfer with fee collection
      const transferResult = await FeeService.processTransferWithFee(
        user.encryptedPrivateKey || "",
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
            realBlockchainTx: true,
          },
        },
      });

      logger.info(
        `REAL blockchain transfer completed: ${amount} cNGN from ${user.walletAddress} to ${recipientAddress}`
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
   * Deposit cNGN to card with REAL blockchain integration (NO Sudo Africa)
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
              whatsappNumber: true,
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

      const amountFloat = parseFloat(amount);

      // Check user's cNGN balance on REAL blockchain
      const balance = await CngnService.getBalance(card.user.walletAddress);
      if (parseFloat(balance.balance) < amountFloat) {
        return { success: false, error: "Insufficient cNGN balance" };
      }

      // Step 1: Deposit to Nelo custody contract (REAL blockchain)
      const depositResult = await NeloContractService.depositTokens(
        card.user.encryptedPrivateKey || "",
        CONTRACT_ADDRESSES.CNGN_TOKEN || "",
        amount
      );

      if (!depositResult.success) {
        return {
          success: false,
          error: depositResult.error || "Blockchain deposit failed",
        };
      }

      // Step 2: Mock card funding (since no Sudo Africa)
      const mockFundResult = MockCardService.fundMockCard(cardId, amountFloat);

      // Step 3: Update card balance in our database
      await this.syncCardBalance(cardId);

      // Step 4: Create transaction record
      await prisma.transaction.create({
        data: {
          userId: card.userId,
          cardId,
          type: "DEPOSIT" as TransactionType,
          amount: amountFloat,
          status: "COMPLETED" as TransactionStatus,
          description: `Deposit to mock card ${card.cardNumber.slice(-4)}`,
          txHash: depositResult.txHash,
          metadata: {
            mockFundingResult: JSON.parse(JSON.stringify(mockFundResult)),
            mockCardId: cardId,
            amountInNGN: amountFloat,
            realBlockchainTx: true,
          },
        },
      });

      // Step 5: Send WhatsApp notification
      try {
        const { WhatsAppService } = await import(
          "@/services/whatsapp/whatsappService"
        );
        const whatsappService = new WhatsAppService();
        const message =
          `💰 *Card Funded Successfully*\n\n` +
          `Amount: ${amountFloat.toFixed(2)} cNGN\n` +
          `Card: ****${card.cardNumber.slice(-4)}\n` +
          `Balance Updated: ✅\n` +
          `Blockchain TX: ${depositResult.txHash?.slice(0, 10)}...\n` +
          `Time: ${new Date().toLocaleString()}\n\n` +
          `Your card is ready for use! 🎉`;

        await whatsappService.sendMessage(card.user.whatsappNumber, message);
      } catch (notificationError) {
        logger.error("Failed to send funding notification:", notificationError);
      }

      logger.info(
        `REAL blockchain deposit completed: ${amount} cNGN to card ${cardId}, TX: ${depositResult.txHash}`
      );

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
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

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
   * Suspend card (mock only, no Sudo Africa)
   */
  static async suspendCard(cardId: string, reason?: string): Promise<boolean> {
    try {
      const card = await prisma.virtualCard.findUnique({
        where: { id: cardId },
        include: { user: true },
      });

      if (!card) {
        logger.error(`Card not found: ${cardId}`);
        return false;
      }

      // Update local database only (no Sudo Africa)
      await prisma.virtualCard.update({
        where: { id: cardId },
        data: {
          status: "SUSPENDED" as VirtualCardStatus,
          metadata: {
            ...((card.metadata as object) || {}),
            suspensionReason: reason,
            suspendedAt: new Date().toISOString(),
          },
        },
      });

      // Send notification
      try {
        const { WhatsAppService } = await import(
          "@/services/whatsapp/whatsappService"
        );
        const whatsappService = new WhatsAppService();
        const message =
          `⚠️ *Card Suspended*\n\n` +
          `Your card ****${card.cardNumber.slice(-4)} has been suspended.\n\n` +
          `${reason ? `Reason: ${reason}\n\n` : ""}` +
          `Please contact support if you need assistance.`;

        await whatsappService.sendMessage(card.user.whatsappNumber, message);
      } catch (notificationError) {
        logger.error(
          "Failed to send suspension notification:",
          notificationError
        );
      }

      logger.info(
        `Mock card suspended: ${cardId}, reason: ${reason || "Not specified"}`
      );
      return true;
    } catch (error) {
      logger.error("Error suspending card:", error);
      return false;
    }
  }

  /**
   * Activate card (mock only, no Sudo Africa)
   */
  static async activateCard(cardId: string): Promise<boolean> {
    try {
      const card = await prisma.virtualCard.findUnique({
        where: { id: cardId },
        include: { user: true },
      });

      if (!card) {
        logger.error(`Card not found: ${cardId}`);
        return false;
      }

      // Update local database only (no Sudo Africa)
      await prisma.virtualCard.update({
        where: { id: cardId },
        data: { status: "ACTIVE" as VirtualCardStatus },
      });

      // Send notification
      try {
        const { WhatsAppService } = await import(
          "@/services/whatsapp/whatsappService"
        );
        const whatsappService = new WhatsAppService();
        const message =
          `✅ *Card Activated*\n\n` +
          `Your card ****${card.cardNumber.slice(
            -4
          )} has been activated and is ready for use!\n\n` +
          `You can now make payments and transactions.`;

        await whatsappService.sendMessage(card.user.whatsappNumber, message);
      } catch (notificationError) {
        logger.error(
          "Failed to send activation notification:",
          notificationError
        );
      }

      logger.info(`Mock card activated: ${cardId}`);
      return true;
    } catch (error) {
      logger.error("Error activating card:", error);
      return false;
    }
  }
}
