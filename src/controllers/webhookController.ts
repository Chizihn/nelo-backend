import { Request, Response } from "express";
import { WhatsAppWebhookPayload } from "@/types/whatsapp.types";
import { MessageHandler } from "@/services/whatsapp/messageHandler";
import { WHATSAPP_CONFIG } from "@/config/whatsapp";
import { logger } from "@/utils/logger";
// Removed Sudo Africa - using mock cards only
import crypto from "crypto";

export class WebhookController {
  private messageHandler: MessageHandler;

  constructor() {
    this.messageHandler = new MessageHandler();
  }

  /**
   * Verify webhook (GET request from Meta)
   */
  verifyWebhook = (req: Request, res: Response): void => {
    try {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      logger.info("Webhook verification request received");

      if (
        mode === "subscribe" &&
        token === WHATSAPP_CONFIG.webhookVerifyToken
      ) {
        logger.info("Webhook verified successfully");
        res.status(200).send(challenge);
      } else {
        logger.error("Webhook verification failed");
        res.status(403).send("Forbidden");
      }
    } catch (error) {
      logger.error("Error in webhook verification:", error);
      res.status(500).send("Internal Server Error");
    }
  };

  /**
   * Handle incoming webhook (POST request from Meta)
   */
  handleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info("🔔 WEBHOOK POST REQUEST RECEIVED!");
      logger.info("Headers:", JSON.stringify(req.headers, null, 2));
      logger.info("Body:", JSON.stringify(req.body, null, 2));

      // Temporarily disable signature verification for debugging
      // if (!this.verifySignature(req)) {
      //   logger.error("Invalid webhook signature");
      //   res.status(401).send("Unauthorized");
      //   return;
      // }

      const payload: WhatsAppWebhookPayload = req.body;

      logger.info(
        "Webhook payload received:",
        JSON.stringify(payload, null, 2)
      );

      // Process each entry
      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field === "messages") {
            await this.processMessages(change.value);
          }
        }
      }

      // Always respond with 200 to acknowledge receipt
      res.status(200).send("OK");
    } catch (error) {
      logger.error("Error handling webhook:", error);
      res.status(500).send("Internal Server Error");
    }
  };

  /**
   * Process incoming messages
   */
  private async processMessages(value: any): Promise<void> {
    try {
      // Extract contact info if available
      const contacts = value.contacts || [];
      const contactMap = new Map();
      contacts.forEach((contact: any) => {
        contactMap.set(contact.wa_id, contact.profile);
      });

      // Process incoming messages
      if (value.messages) {
        for (const message of value.messages) {
          logger.info(
            `Processing message from ${message.from}: ${message.text?.body}`
          );

          // Get contact info for this message
          const contact = contactMap.get(message.from);

          // Handle the message asynchronously
          this.messageHandler
            .processMessage(message, contact)
            .catch((error) => {
              logger.error("Error processing message:", error);
            });
        }
      }

      // Process message status updates
      if (value.statuses) {
        for (const status of value.statuses) {
          logger.info(`Message status update: ${status.id} - ${status.status}`);
          // Handle status updates if needed
        }
      }
    } catch (error) {
      logger.error("Error processing messages:", error);
    }
  }

  /**
   * Verify webhook signature from Meta
   */
  private verifySignature(req: Request): boolean {
    try {
      const signature = req.headers["x-hub-signature-256"] as string;

      if (!signature) {
        logger.error("No signature header found");
        return false;
      }

      // Remove 'sha256=' prefix
      const signatureHash = signature.replace("sha256=", "");

      // Calculate expected signature
      const expectedHash = crypto
        .createHmac("sha256", WHATSAPP_CONFIG.appSecret)
        .update(JSON.stringify(req.body))
        .digest("hex");

      // Compare signatures
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signatureHash, "hex"),
        Buffer.from(expectedHash, "hex")
      );

      if (!isValid) {
        logger.error("Signature verification failed");
      }

      return isValid;
    } catch (error) {
      logger.error("Error verifying signature:", error);
      return false;
    }
  }

  /**
   * Health check endpoint
   */
  healthCheck = (req: Request, res: Response): void => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "whatsapp-webhook",
    });
  };

  /**
   * Get webhook info
   */
  getWebhookInfo = (req: Request, res: Response): void => {
    res.status(200).json({
      webhook: {
        phoneNumberId: WHATSAPP_CONFIG.phoneNumberId,
        apiVersion: WHATSAPP_CONFIG.apiVersion,
        status: "active",
      },
      timestamp: new Date().toISOString(),
    });
  };

  /**
   * Update transaction in database
   */
  private async updateTransactionInDatabase(
    transaction: any,
    event: string
  ): Promise<void> {
    try {
      const { prisma } = await import("@/config/database");

      // Find the card by Bridgecard card ID
      const card = await prisma.virtualCard.findFirst({
        where: { sudoCardId: transaction.card_id },
      });

      if (!card) {
        logger.error(
          `Card not found for Bridgecard ID: ${transaction.card_id}`
        );
        return;
      }

      // Create or update transaction record
      await prisma.transaction.upsert({
        where: {
          sudoTransactionId: transaction.id,
        },
        create: {
          sudoTransactionId: transaction.id,
          userId: card.userId,
          cardId: card.id,
          type: this.mapTransactionType(transaction.type),
          amount: transaction.amount / 100, // Convert from kobo to naira
          status: this.mapTransactionStatus(transaction.status),
          description: `${transaction.merchant?.name || "Transaction"} - ${
            transaction.type
          }`,
          metadata: {
            bridgecardData: transaction,
            merchant: transaction.merchant,
            event: event,
          },
        },
        update: {
          status: this.mapTransactionStatus(transaction.status),
          metadata: {
            bridgecardData: transaction,
            merchant: transaction.merchant,
            event: event,
          },
        },
      });

      logger.info(`Transaction updated in database: ${transaction.id}`);
    } catch (error) {
      logger.error("Error updating transaction in database:", error);
      throw error;
    }
  }

  /**
   * Sync blockchain balance after transaction
   */
  private async syncBlockchainBalance(cardId: string): Promise<void> {
    try {
      const { CardService } = await import("@/services/card/cardService");

      // Find the card by Bridgecard card ID
      const { prisma } = await import("@/config/database");
      const card = await prisma.virtualCard.findFirst({
        where: { sudoCardId: cardId },
      });

      if (card) {
        await CardService.syncCardBalance(card.id);
        logger.info(`Blockchain balance synced for card: ${card.id}`);
      }
    } catch (error) {
      logger.error("Error syncing blockchain balance:", error);
      throw error;
    }
  }

  /**
   * Send transaction notification via WhatsApp
   */
  private async sendTransactionNotification(
    transaction: any,
    event: string
  ): Promise<void> {
    try {
      const { prisma } = await import("@/config/database");

      // Find the user by card
      const card = await prisma.virtualCard.findFirst({
        where: { sudoCardId: transaction.card_id },
        include: { user: true },
      });

      if (!card?.user) {
        logger.error(`User not found for card: ${transaction.card_id}`);
        return;
      }

      const { WhatsAppService } = await import(
        "@/services/whatsapp/whatsappService"
      );

      const amount = (transaction.amount / 100).toFixed(2); // Convert from kobo
      const merchant = transaction.merchant?.name || "Unknown Merchant";
      const status =
        event === "transaction.successful" ? "✅ Successful" : "❌ Failed";

      const message =
        `🔔 *Transaction Alert*\n\n` +
        `Amount: ₦${amount}\n` +
        `Merchant: ${merchant}\n` +
        `Status: ${status}\n` +
        `Card: ****${card.cardNumber.slice(-4)}\n` +
        `Time: ${new Date().toLocaleString()}\n\n` +
        `Transaction ID: ${transaction.id}`;

      const whatsappService = new WhatsAppService();
      await whatsappService.sendMessage(card.user.whatsappNumber, message);
      logger.info(`Transaction notification sent to user: ${card.user.id}`);
    } catch (error) {
      logger.error("Error sending transaction notification:", error);
      throw error;
    }
  }

  /**
   * Handle transaction settlement
   */
  private async handleTransactionSettlement(transaction: any): Promise<void> {
    try {
      const { prisma } = await import("@/config/database");

      // Find the card
      const card = await prisma.virtualCard.findFirst({
        where: { sudoCardId: transaction.card_id },
      });

      if (!card) return;

      // Update card balance
      const newBalance = Number(card.cnmgBalance) - transaction.amount / 100;

      await prisma.virtualCard.update({
        where: { id: card.id },
        data: { cnmgBalance: Math.max(0, newBalance) },
      });

      logger.info(
        `Transaction settled for card: ${card.id}, amount: ${
          transaction.amount / 100
        }`
      );
    } catch (error) {
      logger.error("Error handling transaction settlement:", error);
      throw error;
    }
  }

  /**
   * Update card status in database
   */
  private async updateCardStatusInDatabase(card: any): Promise<void> {
    try {
      const { prisma } = await import("@/config/database");

      await prisma.virtualCard.updateMany({
        where: { sudoCardId: card.id },
        data: {
          status: this.mapCardStatus(card.status),
          metadata: {
            bridgecardData: card,
          },
        },
      });

      logger.info(`Card status updated in database: ${card.id}`);
    } catch (error) {
      logger.error("Error updating card status in database:", error);
      throw error;
    }
  }

  /**
   * Send card status notification
   */
  private async sendCardStatusNotification(
    card: any,
    event: string
  ): Promise<void> {
    try {
      const { prisma } = await import("@/config/database");

      const dbCard = await prisma.virtualCard.findFirst({
        where: { sudoCardId: card.id },
        include: { user: true },
      });

      if (!dbCard?.user) return;

      const { WhatsAppService } = await import(
        "@/services/whatsapp/whatsappService"
      );

      const statusEmoji =
        card.status === "active"
          ? "✅"
          : card.status === "suspended"
          ? "⚠️"
          : "❌";
      const message =
        `🔔 *Card Status Update*\n\n` +
        `Card: ****${dbCard.cardNumber.slice(-4)}\n` +
        `Status: ${statusEmoji} ${card.status.toUpperCase()}\n` +
        `Time: ${new Date().toLocaleString()}`;

      const whatsappService = new WhatsAppService();
      await whatsappService.sendMessage(dbCard.user.whatsappNumber, message);
      logger.info(`Card status notification sent to user: ${dbCard.user.id}`);
    } catch (error) {
      logger.error("Error sending card status notification:", error);
      throw error;
    }
  }

  /**
   * Handle card status business logic
   */
  private async handleCardStatusBusinessLogic(
    card: any,
    event: string
  ): Promise<void> {
    try {
      // If card is suspended, log security event
      if (card.status === "suspended") {
        logger.warn(`Card suspended - security event: ${card.id}`);
      }

      // If card is closed, clean up any pending transactions
      if (card.status === "closed") {
        const { prisma } = await import("@/config/database");

        await prisma.transaction.updateMany({
          where: {
            card: { sudoCardId: card.id },
            status: "PENDING",
          },
          data: { status: "CANCELLED" },
        });
      }
    } catch (error) {
      logger.error("Error in card status business logic:", error);
      throw error;
    }
  }

  /**
   * Update customer in database
   */
  private async updateCustomerInDatabase(customer: any): Promise<void> {
    try {
      const { prisma } = await import("@/config/database");

      await prisma.user.updateMany({
        where: { sudoCustomerId: customer.id },
        data: {
          metadata: {
            bridgecardData: customer,
          },
        },
      });

      logger.info(`Customer updated in database: ${customer.id}`);
    } catch (error) {
      logger.error("Error updating customer in database:", error);
      throw error;
    }
  }

  /**
   * Send welcome message to new customer
   */
  private async sendWelcomeMessage(customer: any): Promise<void> {
    try {
      const { prisma } = await import("@/config/database");

      const user = await prisma.user.findFirst({
        where: { sudoCustomerId: customer.id },
      });

      if (!user) return;

      const { WhatsAppService } = await import(
        "@/services/whatsapp/whatsappService"
      );

      const message =
        `🎉 *Welcome to Nelo!*\n\n` +
        `Hi ${customer.first_name}! Your account has been successfully created.\n\n` +
        `You can now:\n` +
        `• Create virtual cards\n` +
        `• Fund your cards\n` +
        `• Make payments\n` +
        `• Track transactions\n\n` +
        `Type "help" to see all available commands.`;

      const whatsappService = new WhatsAppService();
      await whatsappService.sendMessage(user.whatsappNumber, message);
      logger.info(`Welcome message sent to customer: ${customer.id}`);
    } catch (error) {
      logger.error("Error sending welcome message:", error);
      throw error;
    }
  }

  /**
   * Handle customer business logic
   */
  private async handleCustomerBusinessLogic(
    customer: any,
    event: string
  ): Promise<void> {
    try {
      if (event === "customer.created") {
        // Initialize customer settings, create default preferences, etc.
        logger.info(`New customer onboarded: ${customer.id}`);
      }
    } catch (error) {
      logger.error("Error in customer business logic:", error);
      throw error;
    }
  }

  /**
   * Map Bridgecard transaction type to our enum
   */
  private mapTransactionType(
    bridgecardType: string
  ):
    | "ONRAMP"
    | "OFFRAMP"
    | "DEPOSIT"
    | "WITHDRAWAL"
    | "PAYMENT"
    | "REFUND"
    | "BRIDGE"
    | "TRANSFER" {
    const typeMap: Record<
      string,
      | "ONRAMP"
      | "OFFRAMP"
      | "DEPOSIT"
      | "WITHDRAWAL"
      | "PAYMENT"
      | "REFUND"
      | "BRIDGE"
      | "TRANSFER"
    > = {
      purchase: "PAYMENT",
      withdrawal: "WITHDRAWAL",
      refund: "REFUND",
      reversal: "REFUND",
    };
    return typeMap[bridgecardType] || "PAYMENT";
  }

  /**
   * Map Bridgecard transaction status to our enum
   */
  private mapTransactionStatus(
    bridgecardStatus: string
  ): "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED" {
    const statusMap: Record<
      string,
      "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED"
    > = {
      successful: "COMPLETED",
      failed: "FAILED",
      declined: "FAILED",
      pending: "PENDING",
    };
    return statusMap[bridgecardStatus] || "PENDING";
  }

  /**
   * Map Bridgecard card status to our enum
   */
  private mapCardStatus(
    bridgecardStatus: string
  ): "ACTIVE" | "SUSPENDED" | "CLOSED" {
    const statusMap: Record<string, "ACTIVE" | "SUSPENDED" | "CLOSED"> = {
      active: "ACTIVE",
      inactive: "SUSPENDED",
      suspended: "SUSPENDED",
      blocked: "SUSPENDED",
      expired: "SUSPENDED",
    };
    return statusMap[bridgecardStatus] || "SUSPENDED";
  }
}
