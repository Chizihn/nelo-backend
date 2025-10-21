import { Router } from "express";
import { param, query } from "express-validator";
import { TransactionController } from "@/controllers/transactionController";
import { authenticateToken, authenticateApiKey } from "@/middleware/auth";
import { validateRequest, validateUUID } from "@/middleware/validation";
import { asyncHandler } from "@/middleware/errorHandler";

const router = Router();
const transactionController = new TransactionController();

/**
 * GET /api/transactions/user/:userId - Get user transactions
 */
router.get(
  "/user/:userId",
  authenticateToken,
  [
    param("userId").isUUID().withMessage("Valid user ID required"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Valid page number required"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Valid limit required"),
    query("type")
      .optional()
      .isIn([
        "ONRAMP",
        "OFFRAMP",
        "DEPOSIT",
        "WITHDRAWAL",
        "PAYMENT",
        "REFUND",
        "BRIDGE",
        "TRANSFER",
      ]),
    query("status")
      .optional()
      .isIn(["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]),
  ],
  validateRequest,
  asyncHandler(transactionController.getUserTransactions)
);

/**
 * GET /api/transactions/:transactionId - Get transaction details
 */
router.get(
  "/:transactionId",
  authenticateToken,
  validateUUID("transactionId"),
  asyncHandler(transactionController.getTransaction)
);

/**
 * GET /api/transactions/hash/:txHash - Get transaction by hash
 */
router.get(
  "/hash/:txHash",
  authenticateToken,
  asyncHandler(transactionController.getTransactionByHash)
);

/**
 * GET /api/transactions - Get all transactions (admin only)
 */
router.get(
  "/",
  authenticateApiKey,
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Valid page number required"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Valid limit required"),
    query("type")
      .optional()
      .isIn([
        "ONRAMP",
        "OFFRAMP",
        "DEPOSIT",
        "WITHDRAWAL",
        "PAYMENT",
        "REFUND",
        "BRIDGE",
        "TRANSFER",
      ]),
    query("status")
      .optional()
      .isIn(["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]),
  ],
  validateRequest,
  asyncHandler(transactionController.getAllTransactions)
);

/**
 * GET /api/transactions/stats/summary - Get transaction statistics (admin only)
 */
router.get(
  "/stats/summary",
  authenticateApiKey,
  asyncHandler(transactionController.getTransactionStats)
);

export default router;
