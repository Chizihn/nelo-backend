import { Router } from "express";
import { body, param } from "express-validator";
import { UserController } from "@/controllers/userController";
import { authenticateToken, authenticateApiKey } from "@/middleware/auth";
import {
  validateRequest,
  validateWhatsAppNumber,
  validateUUID,
} from "@/middleware/validation";
import { asyncHandler } from "@/middleware/errorHandler";

const router = Router();
const userController = new UserController();

/**
 * POST /api/users - Create a new user
 */
router.post(
  "/",
  [
    body("whatsappNumber")
      .isMobilePhone("any")
      .withMessage("Valid WhatsApp number required"),
  ],
  validateRequest,
  validateWhatsAppNumber,
  asyncHandler(userController.createUser)
);

/**
 * GET /api/users/whatsapp/:whatsappNumber - Get user by WhatsApp number
 */
router.get(
  "/whatsapp/:whatsappNumber",
  authenticateToken,
  asyncHandler(userController.getUserByWhatsApp)
);

/**
 * GET /api/users/wallet/:walletAddress - Get user by wallet address
 */
router.get(
  "/wallet/:walletAddress",
  authenticateToken,
  asyncHandler(userController.getUserByWallet)
);

/**
 * GET /api/users/:userId - Get user by ID
 */
router.get(
  "/:userId",
  authenticateToken,
  validateUUID("userId"),
  asyncHandler(userController.getUserById)
);

/**
 * PATCH /api/users/:userId/basename - Update user basename
 */
router.patch(
  "/:userId/basename",
  authenticateToken,
  [
    param("userId").isUUID().withMessage("Valid user ID required"),
    body("basename").notEmpty().withMessage("Basename required"),
  ],
  validateRequest,
  asyncHandler(userController.updateBasename)
);

/**
 * GET /api/users/:userId/stats - Get user statistics
 */
router.get(
  "/:userId/stats",
  authenticateToken,
  validateUUID("userId"),
  asyncHandler(userController.getUserStats)
);

/**
 * PATCH /api/users/:userId/status - Update user status (admin only)
 */
router.patch(
  "/:userId/status",
  authenticateApiKey,
  [
    param("userId").isUUID().withMessage("Valid user ID required"),
    body("isActive").isBoolean().withMessage("Valid status required"),
  ],
  validateRequest,
  asyncHandler(userController.updateUserStatus)
);

/**
 * GET /api/users - Get all users (admin only)
 */
router.get("/", authenticateApiKey, asyncHandler(userController.getAllUsers));

/**
 * DELETE /api/users/:userId - Delete user (admin only)
 */
router.delete(
  "/:userId",
  authenticateApiKey,
  validateUUID("userId"),
  asyncHandler(userController.deleteUser)
);

export default router;
