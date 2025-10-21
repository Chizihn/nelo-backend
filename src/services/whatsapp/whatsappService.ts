import axios from "axios";
import { WHATSAPP_CONFIG, WHATSAPP_ENDPOINTS } from "@/config/whatsapp";
import { WhatsAppOutgoingMessage } from "@/types/whatsapp.types";
import { logger } from "@/utils/logger";
import { CONSTANTS } from "@/utils/constants";

export class WhatsAppService {
  private readonly headers = {
    Authorization: `Bearer ${WHATSAPP_CONFIG.accessToken}`,
    "Content-Type": "application/json",
  };

  /**
   * Send text message to WhatsApp user
   */
  async sendMessage(to: string, text: string): Promise<boolean> {
    try {
      // Ensure message doesn't exceed WhatsApp limits
      const truncatedText =
        text.length > CONSTANTS.WHATSAPP_MESSAGE_MAX_LENGTH
          ? text.substring(0, CONSTANTS.WHATSAPP_MESSAGE_MAX_LENGTH - 3) + "..."
          : text;

      const message: WhatsAppOutgoingMessage = {
        messaging_product: "whatsapp",
        to: to.replace("+", ""),
        type: "text",
        text: {
          body: truncatedText,
          preview_url: true,
        },
      };

      const response = await axios.post(WHATSAPP_ENDPOINTS.messages, message, {
        headers: this.headers,
        timeout: CONSTANTS.WEBHOOK_TIMEOUT_MS,
      });

      if (response.data.messages?.[0]?.id) {
        logger.info(
          `Message sent successfully to ${to}: ${response.data.messages[0].id}`
        );
        return true;
      } else {
        logger.error("Failed to send message - no message ID returned");
        return false;
      }
    } catch (error) {
      logger.error("Error sending WhatsApp message:", error);
      return false;
    }
  }

  /**
   * Send interactive button message
   */
  async sendButtonMessage(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>
  ): Promise<boolean> {
    try {
      const message: WhatsAppOutgoingMessage = {
        messaging_product: "whatsapp",
        to: to.replace("+", ""),
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text: bodyText,
          },
          action: {
            buttons: buttons.map((btn) => ({
              type: "reply",
              reply: {
                id: btn.id,
                title: btn.title,
              },
            })),
          },
        },
      };

      const response = await axios.post(WHATSAPP_ENDPOINTS.messages, message, {
        headers: this.headers,
        timeout: CONSTANTS.WEBHOOK_TIMEOUT_MS,
      });

      if (response.data.messages?.[0]?.id) {
        logger.info(`Button message sent successfully to ${to}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error("Error sending button message:", error);
      return false;
    }
  }

  /**
   * Send list message
   */
  async sendListMessage(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>
  ): Promise<boolean> {
    try {
      const message: WhatsAppOutgoingMessage = {
        messaging_product: "whatsapp",
        to: to.replace("+", ""),
        type: "interactive",
        interactive: {
          type: "list",
          body: {
            text: bodyText,
          },
          action: {
            button: buttonText,
            sections,
          },
        },
      };

      const response = await axios.post(WHATSAPP_ENDPOINTS.messages, message, {
        headers: this.headers,
        timeout: CONSTANTS.WEBHOOK_TIMEOUT_MS,
      });

      if (response.data.messages?.[0]?.id) {
        logger.info(`List message sent successfully to ${to}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error("Error sending list message:", error);
      return false;
    }
  }

  /**
   * Send template message
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string = "en",
    components?: any[]
  ): Promise<boolean> {
    try {
      const message: WhatsAppOutgoingMessage = {
        messaging_product: "whatsapp",
        to: to.replace("+", ""),
        type: "template",
        template: {
          name: templateName,
          language: {
            code: languageCode,
          },
          components,
        },
      };

      const response = await axios.post(WHATSAPP_ENDPOINTS.messages, message, {
        headers: this.headers,
        timeout: CONSTANTS.WEBHOOK_TIMEOUT_MS,
      });

      if (response.data.messages?.[0]?.id) {
        logger.info(`Template message sent successfully to ${to}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error("Error sending template message:", error);
      return false;
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<boolean> {
    try {
      const response = await axios.post(
        WHATSAPP_ENDPOINTS.messages,
        {
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        },
        {
          headers: this.headers,
          timeout: CONSTANTS.WEBHOOK_TIMEOUT_MS,
        }
      );

      return response.status === 200;
    } catch (error) {
      logger.error("Error marking message as read:", error);
      return false;
    }
  }

  /**
   * Get media URL from media ID
   */
  async getMediaUrl(mediaId: string): Promise<string | null> {
    try {
      const response = await axios.get(
        `${WHATSAPP_CONFIG.baseUrl}/${WHATSAPP_CONFIG.apiVersion}/${mediaId}`,
        {
          headers: this.headers,
          timeout: CONSTANTS.WEBHOOK_TIMEOUT_MS,
        }
      );

      return response.data.url || null;
    } catch (error) {
      logger.error("Error getting media URL:", error);
      return null;
    }
  }

  /**
   * Download media from URL
   */
  async downloadMedia(mediaUrl: string): Promise<Buffer | null> {
    try {
      const response = await axios.get(mediaUrl, {
        headers: this.headers,
        responseType: "arraybuffer",
        timeout: CONSTANTS.WEBHOOK_TIMEOUT_MS,
      });

      return Buffer.from(response.data);
    } catch (error) {
      logger.error("Error downloading media:", error);
      return null;
    }
  }

  /**
   * Validate WhatsApp number format
   */
  static isValidWhatsAppNumber(number: string): boolean {
    // Remove any non-digit characters except +
    const cleaned = number.replace(/[^\d+]/g, "");

    // Check if it matches WhatsApp number format
    return /^\+?[1-9]\d{1,14}$/.test(cleaned);
  }

  /**
   * Format WhatsApp number
   */
  static formatWhatsAppNumber(number: string): string {
    // Remove any non-digit characters except +
    let cleaned = number.replace(/[^\d+]/g, "");

    // Add + if not present
    if (!cleaned.startsWith("+")) {
      cleaned = "+" + cleaned;
    }

    return cleaned;
  }

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(to: string): Promise<boolean> {
    try {
      // WhatsApp Cloud API doesn't have typing indicators
      // This is a placeholder for future implementation
      return true;
    } catch (error) {
      logger.error("Error sending typing indicator:", error);
      return false;
    }
  }

  /**
   * Get message delivery status
   */
  async getMessageStatus(messageId: string): Promise<string | null> {
    try {
      // This would require webhook status updates
      // Implementation depends on your webhook handling
      return null;
    } catch (error) {
      logger.error("Error getting message status:", error);
      return null;
    }
  }
}
