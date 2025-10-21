import { prisma } from "@/config/database";
import { WalletService } from "../blockchain/walletService";
import { BasenameService } from "../blockchain/basenameService";
import { logger } from "@/utils/logger";
import { REGEX_PATTERNS } from "@/utils/constants";

export class UserService {
  /**
   * Create a new user with wallet
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

      // Generate wallet
      const wallet = WalletService.generateWallet();
      const encryptedPrivateKey = WalletService.encryptPrivateKey(
        wallet.privateKey
      );

      // Create user
      const user = await prisma.user.create({
        data: {
          whatsappNumber,
          walletAddress: wallet.address,
          encryptedPrivateKey,
          publicKey: wallet.publicKey,
        },
      });

      logger.info(`User created: ${user.id} with wallet ${wallet.address}`);

      return {
        id: user.id,
        whatsappNumber: user.whatsappNumber,
        walletAddress: user.walletAddress,
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
