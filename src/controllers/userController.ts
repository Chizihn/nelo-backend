import { Request, Response } from "express";
import { UserService } from "@/services/user/userService";
import { AuthRequest, generateToken } from "@/middleware/auth";
import { logger } from "@/utils/logger";

export class UserController {
  /**
   * Create a new user
   */
  createUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { whatsappNumber } = req.body;

      const user = await UserService.createUser(whatsappNumber);

      // Generate JWT token
      const token = generateToken({
        id: user.id,
        whatsappNumber: user.whatsappNumber,
        walletAddress: user.walletAddress,
      });

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: {
          user,
          token,
        },
      });
    } catch (error) {
      logger.error("Error in createUser controller:", error);

      if (error instanceof Error && error.message.includes("already exists")) {
        res.status(409).json({
          success: false,
          error: "User already exists",
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to create user",
        });
      }
    }
  };

  /**
   * Get user by WhatsApp number
   */
  getUserByWhatsApp = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { whatsappNumber } = req.params;

      // Verify user is requesting their own data
      if (req.user?.whatsappNumber !== whatsappNumber) {
        res.status(403).json({
          success: false,
          error: "Unauthorized to access this user data",
        });
        return;
      }

      const user = await UserService.findByWhatsAppNumber(whatsappNumber);

      if (!user) {
        res.status(404).json({
          success: false,
          error: "User not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error("Error in getUserByWhatsApp controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get user",
      });
    }
  };

  /**
   * Get user by wallet address
   */
  getUserByWallet = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { walletAddress } = req.params;

      // Verify user is requesting their own data
      if (req.user?.walletAddress !== walletAddress) {
        res.status(403).json({
          success: false,
          error: "Unauthorized to access this user data",
        });
        return;
      }

      const user = await UserService.findByWalletAddress(walletAddress);

      if (!user) {
        res.status(404).json({
          success: false,
          error: "User not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error("Error in getUserByWallet controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get user",
      });
    }
  };

  /**
   * Get user by ID
   */
  getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      // Verify user is requesting their own data
      if (req.user?.id !== userId) {
        res.status(403).json({
          success: false,
          error: "Unauthorized to access this user data",
        });
        return;
      }

      const user = await UserService.findByWhatsAppNumber(
        req.user.whatsappNumber
      );

      if (!user) {
        res.status(404).json({
          success: false,
          error: "User not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error("Error in getUserById controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get user",
      });
    }
  };

  /**
   * Update user basename
   */
  updateBasename = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const { basename } = req.body;

      // Verify user is updating their own data
      if (req.user?.id !== userId) {
        res.status(403).json({
          success: false,
          error: "Unauthorized to update this user",
        });
        return;
      }

      const success = await UserService.updateBasename(userId, basename);

      if (success) {
        res.status(200).json({
          success: true,
          message: "Basename updated successfully",
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Failed to update basename",
        });
      }
    } catch (error) {
      logger.error("Error in updateBasename controller:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update basename",
      });
    }
  };

  /**
   * Get user statistics
   */
  getUserStats = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      // Verify user is requesting their own data
      if (req.user?.id !== userId) {
        res.status(403).json({
          success: false,
          error: "Unauthorized to access this user data",
        });
        return;
      }

      const stats = await UserService.getUserStats(userId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error("Error in getUserStats controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get user statistics",
      });
    }
  };

  /**
   * Update user status (admin only)
   */
  updateUserStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const { isActive } = req.body;

      let success = false;
      if (isActive) {
        success = await UserService.reactivateUser(userId);
      } else {
        success = await UserService.deactivateUser(userId);
      }

      if (success) {
        res.status(200).json({
          success: true,
          message: `User ${
            isActive ? "activated" : "deactivated"
          } successfully`,
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Failed to update user status",
        });
      }
    } catch (error) {
      logger.error("Error in updateUserStatus controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update user status",
      });
    }
  };

  /**
   * Get all users (admin only)
   */
  getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await UserService.getAllUsers(page, limit);

      res.status(200).json({
        success: true,
        data: result.users,
        pagination: {
          page,
          limit,
          total: result.total,
          hasNext: result.hasNext,
        },
      });
    } catch (error) {
      logger.error("Error in getAllUsers controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get users",
      });
    }
  };

  /**
   * Delete user (admin only)
   */
  deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      const success = await UserService.deleteUser(userId);

      if (success) {
        res.status(200).json({
          success: true,
          message: "User deleted successfully",
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Failed to delete user",
        });
      }
    } catch (error) {
      logger.error("Error in deleteUser controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete user",
      });
    }
  };
}
