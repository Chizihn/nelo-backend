import { prisma } from "@/config/database";
import { WalletService } from "../blockchain/walletService";
import { BasenameService } from "../blockchain/basenameService";
import { privyService } from "../wallet/privyService";
import { flutterwaveService } from "../payment/flutterwaveService";
import { KYCService } from "../kyc/kycService";
import { logger } from "@/utils/logger";
import { REGEX_PATTERNS } from "@/utils/constants";

export class UserService {
  /**
   * Create a new user with Privy smart wallet
   */
  static async createUser(whatsappNumber: string): Promise<any> {
    try {
      // Validate WhatsApp number
      if (!REGEX_PATTERNS.WHATSAPP_NUMBER.test(whatsappNumber)) {
        throw new Error("Invalid WhatsApp number format");
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { whatsappNumber },
      });

      if (existingUser) {
        throw new Error("User already exists");
      }

      // Create Privy user with embedded wallet
      const privyResult = await privyService.createUserWithWallet(
        whatsappNumber
      );

      if (!privyResult.success || !privyResult.user) {
        throw new Error(`Failed to create Privy user: ${privyResult.error}`);
      }

      const privyUser = privyResult.user;
      const walletAddress = privyUser.wallet?.address;

      if (!walletAddress) {
        logger.error("No wallet address from Privy user creation", {
          privyUserId: privyUser.id,
          privyUser: JSON.stringify(privyUser, null, 2),
          privyResult: JSON.stringify(privyResult, null, 2),
        });
        throw new Error("Failed to get wallet address from Privy");
      }

      logger.info(
        `Successfully got wallet address from Privy: ${walletAddress}`
      );

      // Generate fallback wallet for demo purposes (in case Privy fails)
      let fallbackWallet = null;
      let encryptedPrivateKey = null;
      let publicKey = null;

      try {
        fallbackWallet = WalletService.generateWallet();
        encryptedPrivateKey = WalletService.encryptPrivateKey(
          fallbackWallet.privateKey
        );
        publicKey = fallbackWallet.publicKey;
      } catch (fallbackError) {
        logger.warn("Failed to generate fallback wallet:", fallbackError);
      }

      // Create user with Privy integration
      logger.info(
        `Creating user in database with wallet address: ${walletAddress}`
      );

      const user = await prisma.user.create({
        data: {
          whatsappNumber,
          walletAddress: walletAddress,
          privyUserId: privyUser.id,
          privyWalletAddress: walletAddress,
          encryptedPrivateKey: encryptedPrivateKey || undefined, // Fallback for demo
          publicKey: publicKey || undefined, // Fallback for demo
          metadata: {
            privyData: JSON.parse(JSON.stringify(privyUser)),
            walletType: "privy",
            createdVia: "whatsapp",
          },
        },
      });

      logger.info(`User created successfully in database: ${user.id}`);

      // Create virtual bank account for fiat on/off ramp
      try {
        const phoneDigits = whatsappNumber.slice(-4);
        const mockName = `User${phoneDigits}`;

        const virtualAccountResult =
          await flutterwaveService.createVirtualAccount(
            user.id,
            `${whatsappNumber.replace("+", "")}@nelo.app`,
            whatsappNumber,
            mockName,
            "NeloUser"
          );

        if (virtualAccountResult.success && virtualAccountResult.account) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              virtualAccountNumber: virtualAccountResult.account.accountNumber,
              virtualBankName: virtualAccountResult.account.bankName,
              virtualAccountRef: virtualAccountResult.account.accountReference,
            },
          });

          logger.info(
            `Virtual bank account created for user ${user.id}: ${virtualAccountResult.account.accountNumber}`
          );
        }
      } catch (vaError) {
        logger.warn("Failed to create virtual account:", vaError);
      }

      logger.info(
        `User created: ${user.id} with Privy wallet ${walletAddress}`
      );

      return {
        id: user.id,
        whatsappNumber: user.whatsappNumber,
        walletAddress: user.walletAddress,
        privyUserId: user.privyUserId,
        virtualAccountNumber: user.virtualAccountNumber,
        virtualBankName: user.virtualBankName,
        basename: user.basename,
        isActive: user.isActive,
        createdAt: user.createdAt,
      };
    } catch (error) {
      logger.error("Error creating user:", error);
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  static async getUserById(userId: string): Promise<any | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          whatsappNumber: true,
          walletAddress: true,
          basename: true,
          basenameVerified: true,
          isActive: true,
          kycLevel: true,
          kycVerified: true,
          virtualAccountNumber: true,
          virtualBankName: true,
          encryptedPrivateKey: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user;
    } catch (error) {
      logger.error("Error finding user by ID:", error);
      return null;
    }
  }

  /**
   * Find user by WhatsApp number
   */
  static async findByWhatsAppNumber(
    whatsappNumber: string
  ): Promise<any | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { whatsappNumber },
        select: {
          id: true,
          whatsappNumber: true,
          walletAddress: true,
          basename: true,
          basenameVerified: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user;
    } catch (error) {
      logger.error("Error finding user by WhatsApp number:", error);
      return null;
    }
  }

  /**
   * Find user by wallet address
   */
  static async findByWalletAddress(walletAddress: string): Promise<any | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { walletAddress },
        select: {
          id: true,
          whatsappNumber: true,
          walletAddress: true,
          basename: true,
          basenameVerified: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user;
    } catch (error) {
      logger.error("Error finding user by wallet address:", error);
      return null;
    }
  }

  /**
   * Find user by basename
   */
  static async findByBasename(basename: string): Promise<any | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { basename },
        select: {
          id: true,
          whatsappNumber: true,
          walletAddress: true,
          basename: true,
          basenameVerified: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user;
    } catch (error) {
      logger.error("Error finding user by basename:", error);
      return null;
    }
  }

  /**
   * Get user with encrypted private key (for transactions)
   */
  static async getUserWithPrivateKey(userId: string): Promise<any | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          whatsappNumber: true,
          walletAddress: true,
          encryptedPrivateKey: true,
          basename: true,
          isActive: true,
        },
      });

      return user;
    } catch (error) {
      logger.error("Error getting user with private key:", error);
      return null;
    }
  }

  /**
   * Update user basename
   */
  static async updateBasename(
    userId: string,
    basename: string
  ): Promise<boolean> {
    try {
      // Validate basename format
      if (!BasenameService.isValidBasename(basename)) {
        throw new Error("Invalid basename format");
      }

      // Check if basename is available
      const isRegistered = await BasenameService.isBasenameRegistered(basename);
      if (!isRegistered) {
        throw new Error("Basename is not registered");
      }

      // Resolve basename to get address
      const resolved = await BasenameService.resolveBasename(basename);
      if (!resolved.isValid) {
        throw new Error("Failed to resolve basename");
      }

      // Get user to verify ownership
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Verify that the basename resolves to user's wallet address
      if (resolved.address.toLowerCase() !== user.walletAddress.toLowerCase()) {
        throw new Error("Basename does not belong to this wallet");
      }

      // Update user
      await prisma.user.update({
        where: { id: userId },
        data: {
          basename,
          basenameVerified: true,
        },
      });

      logger.info(`Basename updated for user ${userId}: ${basename}`);
      return true;
    } catch (error) {
      logger.error("Error updating basename:", error);
      throw error;
    }
  }

  /**
   * Deactivate user
   */
  static async deactivateUser(userId: string): Promise<boolean> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      logger.info(`User deactivated: ${userId}`);
      return true;
    } catch (error) {
      logger.error("Error deactivating user:", error);
      return false;
    }
  }

  /**
   * Reactivate user
   */
  static async reactivateUser(userId: string): Promise<boolean> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: true },
      });

      logger.info(`User reactivated: ${userId}`);
      return true;
    } catch (error) {
      logger.error("Error reactivating user:", error);
      return false;
    }
  }

  /**
   * Get user statistics
   */
  static async getUserStats(userId: string): Promise<{
    totalCards: number;
    totalBalance: string;
    totalTransactions: number;
    lastActivity: Date | null;
  }> {
    try {
      const [cards, transactions] = await Promise.all([
        prisma.virtualCard.findMany({
          where: { userId },
          select: { cnmgBalance: true, lastUsedAt: true },
        }),
        prisma.transaction.count({
          where: { userId },
        }),
      ]);

      const totalBalance = cards
        .reduce(
          (sum: number, card: any) =>
            sum + parseFloat(card.cnmgBalance.toString()),
          0
        )
        .toString();

      const lastActivity = cards.reduce((latest: Date | null, card: any) => {
        if (!card.lastUsedAt) return latest;
        if (!latest) return card.lastUsedAt;
        return card.lastUsedAt > latest ? card.lastUsedAt : latest;
      }, null as Date | null);

      return {
        totalCards: cards.length,
        totalBalance,
        totalTransactions: transactions,
        lastActivity,
      };
    } catch (error) {
      logger.error("Error getting user stats:", error);
      return {
        totalCards: 0,
        totalBalance: "0",
        totalTransactions: 0,
        lastActivity: null,
      };
    }
  }

  /**
   * Search users by partial WhatsApp number or basename
   */
  static async searchUsers(query: string, limit: number = 10): Promise<any[]> {
    try {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { whatsappNumber: { contains: query } },
            { basename: { contains: query, mode: "insensitive" } },
          ],
          isActive: true,
        },
        select: {
          id: true,
          whatsappNumber: true,
          walletAddress: true,
          basename: true,
          createdAt: true,
        },
        take: limit,
      });

      return users;
    } catch (error) {
      logger.error("Error searching users:", error);
      return [];
    }
  }

  /**
   * Get all users (admin function)
   */
  static async getAllUsers(
    page: number = 1,
    limit: number = 50
  ): Promise<{
    users: any[];
    total: number;
    hasNext: boolean;
  }> {
    try {
      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          select: {
            id: true,
            whatsappNumber: true,
            walletAddress: true,
            basename: true,
            isActive: true,
            createdAt: true,
            _count: {
              select: {
                virtualCards: true,
                transactions: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.user.count(),
      ]);

      return {
        users,
        total,
        hasNext: skip + limit < total,
      };
    } catch (error) {
      logger.error("Error getting all users:", error);
      return { users: [], total: 0, hasNext: false };
    }
  }

  /**
   * Verify user KYC with mock data
   */
  static async verifyKYC(
    userId: string,
    kycData: {
      firstName: string;
      lastName: string;
      idNumber?: string;
    }
  ): Promise<{
    success: boolean;
    level?: string;
    error?: string;
  }> {
    try {
      const result = await KYCService.verifyUser(userId, kycData);

      if (result.success) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            kycVerified: true,
            kycLevel: result.level,
            firstName: kycData.firstName,
            lastName: kycData.lastName,
          },
        });

        logger.info(`KYC verified for user ${userId}: ${result.level}`);
      }

      return {
        success: result.success,
        level: result.level,
        error: result.error,
      };
    } catch (error) {
      logger.error("Error verifying KYC:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "KYC verification failed",
      };
    }
  }

  /**
   * Get user's KYC status
   */
  static async getKYCStatus(userId: string): Promise<{
    verified: boolean;
    level: string;
    canCreateCard: boolean;
    canWithdraw: boolean;
  }> {
    try {
      const kycStatus = await KYCService.getKYCStatus(userId);
      const cardPermission = await KYCService.canPerformAction(
        userId,
        "CREATE_CARD"
      );
      const withdrawPermission = await KYCService.canPerformAction(
        userId,
        "WITHDRAW"
      );

      return {
        verified: kycStatus.verified,
        level: kycStatus.level,
        canCreateCard: cardPermission.allowed,
        canWithdraw: withdrawPermission.allowed,
      };
    } catch (error) {
      logger.error("Error getting KYC status:", error);
      return {
        verified: false,
        level: "NONE",
        canCreateCard: false,
        canWithdraw: false,
      };
    }
  }

  /**
   * Add bank account for user
   */
  static async addBankAccount(
    userId: string,
    accountNumber: string,
    bankName: string,
    bankCode: string,
    accountName: string
  ): Promise<{
    success: boolean;
    bankAccount?: any;
    error?: string;
  }> {
    try {
      // Check if account already exists
      const existing = await prisma.bankAccount.findFirst({
        where: {
          userId,
          accountNumber,
        },
      });

      if (existing) {
        return {
          success: false,
          error: "Bank account already exists",
        };
      }

      const bankAccount = await prisma.bankAccount.create({
        data: {
          userId,
          accountNumber,
          bankName,
          bankCode,
          accountName,
          isVerified: true, // Mock verification for demo
          metadata: {
            addedVia: "whatsapp",
            mock: true,
          },
        },
      });

      logger.info(`Bank account added for user ${userId}: ${accountNumber}`);

      return {
        success: true,
        bankAccount,
      };
    } catch (error) {
      logger.error("Error adding bank account:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to add bank account",
      };
    }
  }

  /**
   * Get user's bank accounts
   */
  static async getBankAccounts(userId: string): Promise<any[]> {
    try {
      const accounts = await prisma.bankAccount.findMany({
        where: { userId, isActive: true },
        orderBy: { createdAt: "desc" },
      });

      return accounts;
    } catch (error) {
      logger.error("Error getting bank accounts:", error);
      return [];
    }
  }

  /**
   * Update user metadata
   */
  static async updateUserMetadata(
    userId: string,
    metadata: any
  ): Promise<boolean> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { metadata },
      });

      logger.info(`User metadata updated: ${userId}`);
      return true;
    } catch (error) {
      logger.error("Error updating user metadata:", error);
      return false;
    }
  }

  /**
   * Delete user (admin function - use with caution)
   */
  static async deleteUser(userId: string): Promise<boolean> {
    try {
      // This will cascade delete related records due to Prisma schema
      await prisma.user.delete({
        where: { id: userId },
      });

      logger.warn(`User deleted: ${userId}`);
      return true;
    } catch (error) {
      logger.error("Error deleting user:", error);
      return false;
    }
  }
}
