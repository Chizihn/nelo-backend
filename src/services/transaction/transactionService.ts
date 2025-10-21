import { prisma } from "@/config/database";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { logger } from "@/utils/logger";

export interface TransactionFilters {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  userId?: string;
}

export class TransactionService {
  /**
   * Get user transactions with filters
   */
  static async getUserTransactions(
    userId: string,
    filters: TransactionFilters = {}
  ) {
    try {
      const { page = 1, limit = 20, type, status } = filters;
      const skip = (page - 1) * limit;

      const where: any = { userId };

      if (type) {
        where.type = type as TransactionType;
      }

      if (status) {
        where.status = status as TransactionStatus;
      }

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          include: {
            card: {
              select: {
                cardNumber: true,
                tokenId: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.transaction.count({ where }),
      ]);

      return {
        transactions,
        total,
        hasNext: skip + limit < total,
        hasPrev: page > 1,
      };
    } catch (error) {
      logger.error("Error getting user transactions:", error);
      return {
        transactions: [],
        total: 0,
        hasNext: false,
        hasPrev: false,
      };
    }
  }

  /**
   * Get transaction by ID
   */
  static async getTransactionById(transactionId: string) {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          user: {
            select: {
              id: true,
              whatsappNumber: true,
              walletAddress: true,
              basename: true,
            },
          },
          card: {
            select: {
              cardNumber: true,
              tokenId: true,
            },
          },
        },
      });

      return transaction;
    } catch (error) {
      logger.error("Error getting transaction by ID:", error);
      return null;
    }
  }

  /**
   * Get transaction by hash
   */
  static async getTransactionByHash(txHash: string) {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { txHash },
        include: {
          user: {
            select: {
              id: true,
              whatsappNumber: true,
              walletAddress: true,
              basename: true,
            },
          },
          card: {
            select: {
              cardNumber: true,
              tokenId: true,
            },
          },
        },
      });

      return transaction;
    } catch (error) {
      logger.error("Error getting transaction by hash:", error);
      return null;
    }
  }

  /**
   * Get all transactions (admin)
   */
  static async getAllTransactions(filters: TransactionFilters = {}) {
    try {
      const { page = 1, limit = 50, type, status } = filters;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (type) {
        where.type = type as TransactionType;
      }

      if (status) {
        where.status = status as TransactionStatus;
      }

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                whatsappNumber: true,
                walletAddress: true,
                basename: true,
              },
            },
            card: {
              select: {
                cardNumber: true,
                tokenId: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.transaction.count({ where }),
      ]);

      return {
        transactions,
        total,
        hasNext: skip + limit < total,
        hasPrev: page > 1,
      };
    } catch (error) {
      logger.error("Error getting all transactions:", error);
      return {
        transactions: [],
        total: 0,
        hasNext: false,
        hasPrev: false,
      };
    }
  }

  /**
   * Create transaction
   */
  static async createTransaction(data: {
    userId: string;
    cardId?: string;
    type: TransactionType;
    amount: number;
    currency?: string;
    status?: TransactionStatus;
    description?: string;
    txHash?: string;
    metadata?: any;
  }) {
    try {
      const transaction = await prisma.transaction.create({
        data: {
          ...data,
          currency: data.currency || "cNGN",
          status: data.status || TransactionStatus.PENDING,
        },
      });

      logger.info(`Transaction created: ${transaction.id}`);
      return transaction;
    } catch (error) {
      logger.error("Error creating transaction:", error);
      throw error;
    }
  }

  /**
   * Update transaction status
   */
  static async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
    txHash?: string
  ) {
    try {
      const updateData: any = { status };
      if (txHash) {
        updateData.txHash = txHash;
      }

      const transaction = await prisma.transaction.update({
        where: { id: transactionId },
        data: updateData,
      });

      logger.info(`Transaction status updated: ${transactionId} -> ${status}`);
      return transaction;
    } catch (error) {
      logger.error("Error updating transaction status:", error);
      throw error;
    }
  }

  /**
   * Get transaction statistics
   */
  static async getTransactionStats() {
    try {
      const [
        totalTransactions,
        completedTransactions,
        pendingTransactions,
        failedTransactions,
        totalVolume,
        transactionsByType,
        recentTransactions,
      ] = await Promise.all([
        prisma.transaction.count(),
        prisma.transaction.count({
          where: { status: TransactionStatus.COMPLETED },
        }),
        prisma.transaction.count({
          where: { status: TransactionStatus.PENDING },
        }),
        prisma.transaction.count({
          where: { status: TransactionStatus.FAILED },
        }),
        prisma.transaction.aggregate({
          where: { status: TransactionStatus.COMPLETED },
          _sum: { amount: true },
        }),
        prisma.transaction.groupBy({
          by: ["type"],
          _count: { type: true },
          _sum: { amount: true },
        }),
        prisma.transaction.findMany({
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                whatsappNumber: true,
                walletAddress: true,
              },
            },
          },
        }),
      ]);

      return {
        summary: {
          totalTransactions,
          completedTransactions,
          pendingTransactions,
          failedTransactions,
          totalVolume: totalVolume._sum.amount || 0,
          successRate:
            totalTransactions > 0
              ? ((completedTransactions / totalTransactions) * 100).toFixed(2)
              : "0",
        },
        byType: transactionsByType.map((item) => ({
          type: item.type,
          count: item._count.type,
          volume: item._sum.amount || 0,
        })),
        recent: recentTransactions,
      };
    } catch (error) {
      logger.error("Error getting transaction stats:", error);
      return {
        summary: {
          totalTransactions: 0,
          completedTransactions: 0,
          pendingTransactions: 0,
          failedTransactions: 0,
          totalVolume: 0,
          successRate: "0",
        },
        byType: [],
        recent: [],
      };
    }
  }

  /**
   * Get pending transactions
   */
  static async getPendingTransactions(limit: number = 100) {
    try {
      const transactions = await prisma.transaction.findMany({
        where: {
          status: {
            in: [TransactionStatus.PENDING, TransactionStatus.PROCESSING],
          },
        },
        include: {
          user: {
            select: {
              id: true,
              encryptedPrivateKey: true,
              walletAddress: true,
            },
          },
          card: {
            select: {
              tokenId: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: limit,
      });

      return transactions;
    } catch (error) {
      logger.error("Error getting pending transactions:", error);
      return [];
    }
  }

  /**
   * Delete transaction (admin only)
   */
  static async deleteTransaction(transactionId: string) {
    try {
      await prisma.transaction.delete({
        where: { id: transactionId },
      });

      logger.warn(`Transaction deleted: ${transactionId}`);
      return true;
    } catch (error) {
      logger.error("Error deleting transaction:", error);
      return false;
    }
  }
}
