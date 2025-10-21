import { Request, Response } from "express";
import { CardService } from "@/services/card/cardService";
import { AuthRequest } from "@/middleware/auth";
import { logger } from "@/utils/logger";

export class CardController {
  /**
   * Create a new virtual card
   */
  createCard = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.body;

      // Verify user owns the request or is admin
      if (req.user?.id !== userId) {
        res.status(403).json({
          success: false,
          error: "Unauthorized to create card for this user",
        });
        return;
      }

      const result = await CardService.createCard(userId);

      if (result.success) {
        res.status(201).json({
          success: true,
          message: "Virtual card created successfully",
          data: result.data,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("Error in createCard controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create card",
      });
    }
  };

  /**
   * Get all cards for a user
   */
  getUserCards = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      // Verify user owns the request
      if (req.user?.id !== userId) {
        res.status(403).json({
          success: false,
          error: "Unauthorized to access these cards",
        });
        return;
      }

      const cards = await CardService.getUserCards(userId);

      res.status(200).json({
        success: true,
        data: cards,
        count: cards.length,
      });
    } catch (error) {
      logger.error("Error in getUserCards controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get user cards",
      });
    }
  };

  /**
   * Get card details
   */
  getCard = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { cardId } = req.params;

      const card = await CardService.getCardById(cardId);

      if (!card) {
        res.status(404).json({
          success: false,
          error: "Card not found",
        });
        return;
      }

      // Verify user owns the card
      if (req.user?.id !== card.userId) {
        res.status(403).json({
          success: false,
          error: "Unauthorized to access this card",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: card,
      });
    } catch (error) {
      logger.error("Error in getCard controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get card",
      });
    }
  };

  /**
   * Sync card balance from blockchain
   */
  syncBalance = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { cardId } = req.params;

      // Get card to verify ownership
      const card = await CardService.getCardById(cardId);
      if (!card) {
        res.status(404).json({
          success: false,
          error: "Card not found",
        });
        return;
      }

      // Verify user owns the card
      if (req.user?.id !== card.userId) {
        res.status(403).json({
          success: false,
          error: "Unauthorized to sync this card",
        });
        return;
      }

      const success = await CardService.syncCardBalance(cardId);

      if (success) {
        // Get updated card
        const updatedCard = await CardService.getCardById(cardId);
        res.status(200).json({
          success: true,
          message: "Balance synced successfully",
          data: updatedCard,
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Failed to sync balance",
        });
      }
    } catch (error) {
      logger.error("Error in syncBalance controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to sync balance",
      });
    }
  };

  /**
   * Deposit to card
   */
  depositToCard = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { cardId } = req.params;
      const { amount } = req.body;

      // Get card to verify ownership
      const card = await CardService.getCardById(cardId);
      if (!card) {
        res.status(404).json({
          success: false,
          error: "Card not found",
        });
        return;
      }

      // Verify user owns the card
      if (req.user?.id !== card.userId) {
        res.status(403).json({
          success: false,
          error: "Unauthorized to deposit to this card",
        });
        return;
      }

      const result = await CardService.depositToCard(cardId, amount);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: "Deposit successful",
          data: {
            txHash: result.txHash,
            amount,
          },
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("Error in depositToCard controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to deposit to card",
      });
    }
  };

  /**
   * Process payment from card
   */
  processPayment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { cardId } = req.params;
      const { amount, recipient, description } = req.body;

      // Get card to verify ownership
      const card = await CardService.getCardById(cardId);
      if (!card) {
        res.status(404).json({
          success: false,
          error: "Card not found",
        });
        return;
      }

      // Verify user owns the card
      if (req.user?.id !== card.userId) {
        res.status(403).json({
          success: false,
          error: "Unauthorized to use this card",
        });
        return;
      }

      // For now, use the send money function
      const result = await CardService.sendMoney(
        card.userId,
        amount,
        recipient
      );

      if (result.success) {
        res.status(200).json({
          success: true,
          message: "Payment successful",
          data: {
            txHash: result.txHash,
            amount,
            recipient,
            description,
          },
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("Error in processPayment controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to process payment",
      });
    }
  };

  /**
   * Update card status
   */
  updateCardStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { cardId } = req.params;
      const { status } = req.body;

      // Get card to verify ownership
      const card = await CardService.getCardById(cardId);
      if (!card) {
        res.status(404).json({
          success: false,
          error: "Card not found",
        });
        return;
      }

      // Verify user owns the card
      if (req.user?.id !== card.userId) {
        res.status(403).json({
          success: false,
          error: "Unauthorized to update this card",
        });
        return;
      }

      let success = false;
      if (status === "SUSPENDED") {
        success = await CardService.suspendCard(cardId);
      } else if (status === "ACTIVE") {
        success = await CardService.activateCard(cardId);
      }

      if (success) {
        res.status(200).json({
          success: true,
          message: `Card ${status.toLowerCase()} successfully`,
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Failed to update card status",
        });
      }
    } catch (error) {
      logger.error("Error in updateCardStatus controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update card status",
      });
    }
  };

  /**
   * Get card transactions
   */
  getCardTransactions = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { cardId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      // Get card to verify ownership
      const card = await CardService.getCardById(cardId);
      if (!card) {
        res.status(404).json({
          success: false,
          error: "Card not found",
        });
        return;
      }

      // Verify user owns the card
      if (req.user?.id !== card.userId) {
        res.status(403).json({
          success: false,
          error: "Unauthorized to access card transactions",
        });
        return;
      }

      const transactions = await CardService.getRecentTransactions(
        card.userId,
        limit
      );

      res.status(200).json({
        success: true,
        data: transactions,
        count: transactions.length,
      });
    } catch (error) {
      logger.error("Error in getCardTransactions controller:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get card transactions",
      });
    }
  };
}
