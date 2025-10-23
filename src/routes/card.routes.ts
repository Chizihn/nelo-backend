import { Router } from "express";
import { body, param } from "express-validator";
import { CardController } from "../controllers/cardController";
import { authenticateToken } from "../middleware/auth";
import {
  validateRequest,
  validateUUID,
  validateAmount,
} from "../middleware/validation";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();
const cardController = new CardController();

/**
 * POST /api/cards - Create a new virtual card
 */
router.post(
  "/",
  authenticateToken,
  [body("userId").isUUID().withMessage("Valid user ID required")],
  validateRequest,
  asyncHandler(cardController.createCard)
);

/**
 * GET /api/cards/user/:userId - Get all cards for a user
 */
router.get(
  "/user/:userId",
  authenticateToken,
  validateUUID("userId"),
  asyncHandler(cardController.getUserCards)
);

/**
 * GET /api/cards/:cardId - Get card details
 */
router.get(
  "/:cardId",
  authenticateToken,
  validateUUID("cardId"),
  asyncHandler(cardController.getCard)
);

/**
 * PATCH /api/cards/:cardId/balance - Sync card balance from blockchain
 */
router.patch(
  "/:cardId/balance",
  authenticateToken,
  validateUUID("cardId"),
  asyncHandler(cardController.syncBalance)
);

/**
 * POST /api/cards/:cardId/deposit - Deposit to card
 */
router.post(
  "/:cardId/deposit",
  authenticateToken,
  [
    param("cardId").isUUID().withMessage("Valid card ID required"),
    body("amount").isNumeric().withMessage("Valid amount required"),
  ],
  validateRequest,
  validateAmount,
  asyncHandler(cardController.depositToCard)
);

/**
 * POST /api/cards/:cardId/payment - Process payment from card
 */
router.post(
  "/:cardId/payment",
  authenticateToken,
  [
    param("cardId").isUUID().withMessage("Valid card ID required"),
    body("amount").isNumeric().withMessage("Valid amount required"),
    body("recipient").notEmpty().withMessage("Recipient required"),
    body("description").optional().isString(),
  ],
  validateRequest,
  validateAmount,
  asyncHandler(cardController.processPayment)
);

/**
 * PATCH /api/cards/:cardId/status - Update card status
 */
router.patch(
  "/:cardId/status",
  authenticateToken,
  [
    param("cardId").isUUID().withMessage("Valid card ID required"),
    body("status")
      .isIn(["ACTIVE", "SUSPENDED", "CLOSED"])
      .withMessage("Valid status required"),
  ],
  validateRequest,
  asyncHandler(cardController.updateCardStatus)
);

/**
 * GET /api/cards/:cardId/transactions - Get card transactions
 */
router.get(
  "/:cardId/transactions",
  authenticateToken,
  validateUUID("cardId"),
  asyncHandler(cardController.getCardTransactions)
);

export default router;
