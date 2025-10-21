import { Request, Response } from "express";
import { TransactionService } from "@/services/transaction/transactionService";
import { AuthRequest } from "@/middleware/auth";
import { logger } from "@/utils/logger";

export class TransactionController {
  /**
   * Get user transactions
   */
  getUserTransactions = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as string;
      const status = req.query.status as string;

      // Verify user is requesting their own data
      if (req.user?.id !== userId) {
        res.status(403).json({
          success: false,
          error: "Unauthorized to access these transactions",
        });
        return;
      }

      const result = await TransactionService.getUserTransactions(userId, {
        page,
        limit,
        type,
        status,
      });

      res.status(200).json({
        success: true,
        data: result.transactions,
        pagination: {
          page,
          limit,
          total: result.total,
          hasNext: result.hasNext,
          hasPrev: result.hasPrev,
        },
      });
    } catch (error) {
      logger.error("Error in getUserTransactions controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get user transactions",
      });
    }
  };

  /**
   * Get transaction details
   */
  getTransaction = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { transactionId } = req.params;

      const transaction = await TransactionService.getTransactionById(
        transactionId
      );

      if (!transaction) {
        res.status(404).json({
          success: false,
          error: "Transaction not found",
        });
        return;
      }

      // Verify user owns the transaction
      if (req.user?.id !== transaction.userId) {
        res.status(403).json({
          success: false,
          error: "Unauthorized to access this transaction",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      logger.error("Error in getTransaction controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get transaction",
      });
    }
  };

  /**
   * Get transaction by hash
   */
  getTransactionByHash = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { txHash } = req.params;

      const transaction = await TransactionService.getTransactionByHash(txHash);

      if (!transaction) {
        res.status(404).json({
          success: false,
          error: "Transaction not found",
        });
        return;
      }

      // Verify user owns the transaction
      if (req.user?.id !== transaction.userId) {
        res.status(403).json({
          success: false,
          error: "Unauthorized to access this transaction",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      logger.error("Error in getTransactionByHash controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get transaction",
      });
    }
  };

  /**
   * Get all transactions (admin only)
   */
  getAllTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const type = req.query.type as string;
      const status = req.query.status as string;

      const result = await TransactionService.getAllTransactions({
        page,
        limit,
        type,
        status,
      });

      res.status(200).json({
        success: true,
        data: result.transactions,
        pagination: {
          page,
          limit,
          total: result.total,
          hasNext: result.hasNext,
          hasPrev: result.hasPrev,
        },
      });
    } catch (error) {
      logger.error("Error in getAllTransactions controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get transactions",
      });
    }
  };

  /**
   * Get transaction statistics (admin only)
   */
  getTransactionStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await TransactionService.getTransactionStats();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error("Error in getTransactionStats controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get transaction statistics",
      });
    }
  };
}
