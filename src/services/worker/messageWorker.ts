import { UserService } from "../user/userService";
import { WhatsAppService } from "../whatsapp/whatsappService";
import { CardService } from "../card/cardService";
import { logger } from "@/utils/logger";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class MessageWorker {
  private whatsappService: WhatsAppService;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.whatsappService = new WhatsAppService();
  }

  /**
   * Start the message worker
   */
  start(): void {
    // Run every 12 hours (12 * 60 * 60 * 1000 ms)
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;

    logger.info(
      "🤖 Message Worker started - will send periodic messages every 12 hours"
    );

    this.intervalId = setInterval(async () => {
      await this.sendPeriodicMessages();
    }, TWELVE_HOURS);

    // Also run once immediately (after 5 minutes to let system settle)
    setTimeout(async () => {
      await this.sendPeriodicMessages();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop the message worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info("🛑 Message Worker stopped");
    }
  }

  /**
   * Send periodic messages to users based on their activity
   */
  private async sendPeriodicMessages(): Promise<void> {
    try {
      logger.info("📨 Starting periodic message broadcast...");

      // Get users who haven't been active recently
      const inactiveUsers = await this.getInactiveUsers();
      const newUsers = await this.getNewUsers();
      const activeUsers = await this.getActiveUsers();

      // Send different messages based on user segments
      await this.sendToInactiveUsers(inactiveUsers);
      await this.sendToNewUsers(newUsers);
      await this.sendToActiveUsers(activeUsers);

      logger.info(
        `📨 Periodic messages sent to ${
          inactiveUsers.length + newUsers.length + activeUsers.length
        } users`
      );
    } catch (error) {
      logger.error("❌ Error sending periodic messages:", error);
    }
  }

  /**
   * Get users who haven't been active in the last 3 days
   */
  private async getInactiveUsers(): Promise<any[]> {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    return await prisma.user.findMany({
      where: {
        updatedAt: {
          lt: threeDaysAgo,
        },
        createdAt: {
          lt: threeDaysAgo, // Exclude very new users
        },
      },
      take: 50, // Limit to prevent spam
    });
  }

  /**
   * Get users created in the last 24 hours
   */
  private async getNewUsers(): Promise<any[]> {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    return await prisma.user.findMany({
      where: {
        createdAt: {
          gte: oneDayAgo,
        },
      },
      take: 20, // Limit new user messages
    });
  }

  /**
   * Get active users (for tips and updates)
   */
  private async getActiveUsers(): Promise<any[]> {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    return await prisma.user.findMany({
      where: {
        updatedAt: {
          gte: oneDayAgo,
        },
      },
      take: 30, // Limit active user tips
    });
  }

  /**
   * Send re-engagement messages to inactive users
   */
  private async sendToInactiveUsers(users: any[]): Promise<void> {
    const messages = [
      `👋 Hey there! We miss you at Nelo!

🎯 *Quick reminder of what you can do:*
• Check balance: "balance"
• Buy crypto: "buy cngn"
• Send money: "send [amount] to [address]"
• Get help: "help"

💡 *New features added:*
• Transparent gas fees
• Enhanced security
• Better user experience

Type "help" to get back started! 🚀`,

      `💰 *Nelo Update* - Your Web3 wallet is waiting!

🇳🇬 *For Nigerians:*
• Buy cNGN with bank transfer
• Send money instantly
• Create virtual cards

🌍 *For Everyone:*
• Buy USDC globally
• Send crypto worldwide
• Secure transactions

Ready to continue? Type "balance" to check your account! 💳`,

      `🔐 *Security Reminder from Nelo*

Your crypto wallet is secure, but here's a quick check:

✅ *Account Status:*
• Wallet: Protected
• PIN: ${(await this.hasPinSetup(users[0]?.id)) ? "Set up" : "Needs setup"}
• KYC: ${(await this.hasKYC(users[0]?.id)) ? "Verified" : "Pending"}

${
  (await this.hasPinSetup(users[0]?.id))
    ? 'Type "balance" to check your funds!'
    : 'Type "setup pin" to secure your account!'
}

Need help? Contact: nelovirtualcards@gmail.com 📧`,
    ];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const message = messages[i % messages.length];

      try {
        await this.whatsappService.sendMessage(user.whatsappNumber, message);
        await this.delay(2000); // 2 second delay between messages
      } catch (error) {
        logger.warn(`Failed to send message to ${user.whatsappNumber}:`, error);
      }
    }
  }

  /**
   * Send welcome tips to new users
   */
  private async sendToNewUsers(users: any[]): Promise<void> {
    const welcomeTips = [
      `🎉 *Welcome to Nelo!* Day 1 tip:

🚀 *Getting Started Checklist:*
1. ✅ Account created
2. 🆔 Complete KYC: "submit kyc"
3. 🔐 Set PIN: "setup pin"
4. 💳 Create card: "create card"
5. 💰 Buy crypto: "buy cngn"

*Why KYC?* Security, compliance, and higher limits!

Ready for step 2? Type "submit kyc" 📝

Need help? Contact: nelovirtualcards@gmail.com`,

      `💡 *Nelo Pro Tip* - Day 1 Success Guide:

🎯 *Most Popular First Actions:*
• 🇳🇬 Nigerians: "buy cngn" (bank transfer)
• 🌍 International: "buy usdc" (card/bank)
• 💳 Everyone: "create card" (virtual card)

*Quick Commands:*
• "help" - See all options
• "balance" - Check your crypto
• "profile" - Account info

*Questions?* We're here to help!
📧 nelovirtualcards@gmail.com

Type "help" to explore! 🚀`,
    ];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const message = welcomeTips[i % welcomeTips.length];

      try {
        await this.whatsappService.sendMessage(user.whatsappNumber, message);
        await this.delay(3000); // 3 second delay for new users
      } catch (error) {
        logger.warn(
          `Failed to send welcome tip to ${user.whatsappNumber}:`,
          error
        );
      }
    }
  }

  /**
   * Send tips and updates to active users
   */
  private async sendToActiveUsers(users: any[]): Promise<void> {
    const tips = [
      `💡 *Nelo Pro Tip* - Gas Fees Explained:

⛽ *Why Gas Fees?*
• Blockchain transaction costs
• Network security payments
• Transparent pricing

💰 *Your Benefits:*
• See exact costs upfront
• No hidden fees
• Pay only what you use

*Example:* Send 1000 cNGN
• Service fee: 10 cNGN
• Gas fee: ~75 cNGN
• Total cost: 1085 cNGN
• Recipient gets: 1000 cNGN

Questions? nelovirtualcards@gmail.com 📧`,

      `🚀 *Nelo Feature Spotlight* - Basename Support:

🏷️ *Send to Easy Names:*
Instead of: 0x1234...abcd
Use: alice.base.eth

*How it works:*
"send 1000 to alice.base.eth" ✅
"send 50 usdc to bob.base.eth" ✅

*Benefits:*
• Easy to remember
• No copy/paste errors
• Professional addresses

Try it: "check basename alice.base.eth"

Need help? nelovirtualcards@gmail.com 📧`,

      `💳 *Nelo Update* - Multi-Token Support:

🪙 *Supported Tokens:*
🇳🇬 cNGN - Nigerian Naira token
💵 USDC - US Dollar coin

*Commands:*
• "buy cngn" - For Nigerians
• "buy usdc" - For international users
• "balance" - See all your tokens
• "send 100 usdc to alice.base.eth"

*All on Base Sepolia testnet* 🔗

Questions? nelovirtualcards@gmail.com 📧`,
    ];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const message = tips[i % tips.length];

      try {
        await this.whatsappService.sendMessage(user.whatsappNumber, message);
        await this.delay(4000); // 4 second delay for tips
      } catch (error) {
        logger.warn(`Failed to send tip to ${user.whatsappNumber}:`, error);
      }
    }
  }

  /**
   * Check if user has PIN setup
   */
  private async hasPinSetup(userId: string): Promise<boolean> {
    if (!userId) return false;
    try {
      const { PinService } = await import("../security/pinService");
      return await PinService.hasPinSetup(userId);
    } catch {
      return false;
    }
  }

  /**
   * Check if user has KYC
   */
  private async hasKYC(userId: string): Promise<boolean> {
    if (!userId) return false;
    try {
      const kycStatus = await UserService.getKYCStatus(userId);
      return kycStatus.verified;
    } catch {
      return false;
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Send a broadcast message to all users (admin function)
   */
  async sendBroadcast(message: string, userLimit: number = 100): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        take: userLimit,
        orderBy: {
          updatedAt: "desc",
        },
      });

      logger.info(`📢 Broadcasting message to ${users.length} users`);

      for (const user of users) {
        try {
          await this.whatsappService.sendMessage(user.whatsappNumber, message);
          await this.delay(1000); // 1 second delay between broadcasts
        } catch (error) {
          logger.warn(`Failed to broadcast to ${user.whatsappNumber}:`, error);
        }
      }

      logger.info(`📢 Broadcast completed to ${users.length} users`);
    } catch (error) {
      logger.error("❌ Error sending broadcast:", error);
    }
  }
}

// Export singleton instance
export const messageWorker = new MessageWorker();
