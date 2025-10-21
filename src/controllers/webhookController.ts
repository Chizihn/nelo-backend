import { Request, Response } from "express";
import { WhatsAppWebhookPayload } from "@/types/whatsapp.types";
import { MessageHandler } from "@/services/whatsapp/messageHandler";
import { WHATSAPP_CONFIG } from "@/config/whatsapp";
import { logger } from "@/utils/logger";
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
      // Verify webhook signature
      if (!this.verifySignature(req)) {
        logger.error("Invalid webhook signature");
        res.status(401).send("Unauthorized");
        return;
      }

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
}
