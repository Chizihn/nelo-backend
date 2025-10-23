import { MessageContext } from "@/types/whatsapp.types";
import { logger } from "@/utils/logger";

export class ResponseBuilder {
  /**
   * Build formatted response message
   */
  buildResponse(template: string, data?: Record<string, any>): string {
    try {
      if (!data) return template;

      let response = template;

      // Replace placeholders with actual data
      Object.entries(data).forEach(([key, value]) => {
        const placeholder = `{${key}}`;
        response = response.replace(
          new RegExp(placeholder, "g"),
          String(value)
        );
      });

      return response;
    } catch (error) {
      logger.error("Error building response:", error);
      return template;
    }
  }

  /**
   * Build card info response
   */
  buildCardInfo(card: any): string {
    const status = card.status === "ACTIVE" ? "✅ Active" : "⏸️ Suspended";
    const lastUsed = card.lastUsedAt
      ? new Date(card.lastUsedAt).toLocaleDateString()
      : "Never";

    return `💳 *Card ${card.cardNumber.slice(-4)}*

💰 Balance: ${card.cNGNBalance} cNGN
📊 Status: ${status}
🕒 Last Used: ${lastUsed}
🆔 Token ID: ${card.tokenId}`;
  }

  /**
   * Build transaction info response
   */
  buildTransactionInfo(transaction: any): string {
    const statusEmoji = this.getStatusEmoji(transaction.status);
    const typeEmoji = this.getTypeEmoji(transaction.type);
    const date = new Date(transaction.createdAt).toLocaleString();

    let response = `${typeEmoji} *${transaction.type}*\n`;
    response += `💰 Amount: ${transaction.amount} ${transaction.currency}\n`;
    response += `📊 Status: ${statusEmoji} ${transaction.status}\n`;
    response += `📅 Date: ${date}\n`;

    if (transaction.description) {
      response += `📝 Note: ${transaction.description}\n`;
    }

    if (transaction.txHash) {
      response += `🔗 TX: \`${transaction.txHash}\`\n`;
      response += `🔍 View: https://sepolia.basescan.org/tx/${transaction.txHash}`;
    }

    return response;
  }

  /**
   * Build balance summary response
   */
  buildBalanceSummary(totalBalance: string, cards: any[]): string {
    let response = `💰 *Balance Summary*\n\n`;
    response += `Total cNGN: *${totalBalance}*\n`;
    response += `Active Cards: *${cards.length}*\n\n`;

    if (cards.length > 0) {
      response += `📱 *Card Breakdown:*\n`;
      cards.forEach((card, index) => {
        response += `${index + 1}. Card ${card.cardNumber.slice(-4)}: ${
          card.cNGNBalance
        } cNGN\n`;
      });
    }

    return response;
  }

  /**
   * Build error response
   */
  buildErrorResponse(error: string, suggestion?: string): string {
    let response = `❌ ${error}`;

    if (suggestion) {
      response += `\n\n💡 ${suggestion}`;
    }

    return response;
  }

  /**
   * Build success response
   */
  buildSuccessResponse(message: string, details?: Record<string, any>): string {
    let response = `✅ ${message}`;

    if (details) {
      response += "\n\n";
      Object.entries(details).forEach(([key, value]) => {
        response += `${this.formatKey(key)}: ${value}\n`;
      });
    }

    return response;
  }

  /**
   * Build menu response
   */
  buildMenuResponse(
    title: string,
    options: Array<{ key: string; description: string }>
  ): string {
    let response = `${title}\n\n`;

    options.forEach((option, index) => {
      response += `${index + 1}. *${option.key}* - ${option.description}\n`;
    });

    response += `\nType the command or number to continue.`;

    return response;
  }

  /**
   * Build confirmation response
   */
  buildConfirmationResponse(
    action: string,
    details: Record<string, any>
  ): string {
    let response = `🤔 *Confirm ${action}*\n\n`;

    Object.entries(details).forEach(([key, value]) => {
      response += `${this.formatKey(key)}: ${value}\n`;
    });

    response += `\nReply *YES* to confirm or *NO* to cancel.`;

    return response;
  }

  /**
   * Build progress response
   */
  buildProgressResponse(
    step: number,
    totalSteps: number,
    message: string
  ): string {
    const progress = "▓".repeat(step) + "░".repeat(totalSteps - step);
    return `⏳ *Step ${step}/${totalSteps}*\n[${progress}]\n\n${message}`;
  }

  /**
   * Build list response
   */
  buildListResponse<T>(
    title: string,
    items: T[],
    formatter: (item: T, index: number) => string,
    emptyMessage: string = "No items found."
  ): string {
    if (items.length === 0) {
      return `📋 *${title}*\n\n${emptyMessage}`;
    }

    let response = `📋 *${title}*\n\n`;
    items.forEach((item, index) => {
      response += formatter(item, index) + "\n\n";
    });

    return response.trim();
  }

  /**
   * Get status emoji
   */
  private getStatusEmoji(status: string): string {
    const statusEmojis: Record<string, string> = {
      PENDING: "⏳",
      PROCESSING: "🔄",
      COMPLETED: "✅",
      FAILED: "❌",
      CANCELLED: "⏹️",
      ACTIVE: "✅",
      SUSPENDED: "⏸️",
      CLOSED: "🔒",
    };

    return statusEmojis[status] || "❓";
  }

  /**
   * Get transaction type emoji
   */
  private getTypeEmoji(type: string): string {
    const typeEmojis: Record<string, string> = {
      DEPOSIT: "💰",
      WITHDRAWAL: "💸",
      PAYMENT: "💳",
      TRANSFER: "🔄",
      ONRAMP: "📈",
      OFFRAMP: "📉",
      REFUND: "↩️",
      BRIDGE: "🌉",
    };

    return typeEmojis[type] || "💱";
  }

  /**
   * Format key for display
   */
  private formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  /**
   * Truncate text to fit WhatsApp limits
   */
  truncateText(text: string, maxLength: number = 4000): string {
    if (text.length <= maxLength) return text;

    return text.substring(0, maxLength - 3) + "...";
  }

  /**
   * Format amount for display
   */
  formatAmount(amount: string | number, currency: string = "cNGN"): string {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;

    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M ${currency}`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K ${currency}`;
    } else {
      return `${num.toFixed(2)} ${currency}`;
    }
  }

  /**
   * Format address for display
   */
  formatAddress(address: string): string {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Format date for display
   */
  formatDate(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}
