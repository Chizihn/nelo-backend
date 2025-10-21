import {
  WhatsAppMessage,
  MessageContext,
  UserSession,
} from "@/types/whatsapp.types";
import { UserService } from "../user/userService";
import { CardService } from "../card/cardService";
import { BasenameService } from "../blockchain/basenameService";
import { OnRampService } from "../payment/onRampService";
import { OffRampService } from "../payment/offRampService";
import { logger } from "@/utils/logger";
import { MESSAGE_TEMPLATES } from "@/config/whatsapp";
import { IntentParser } from "./intentParser";
import { ResponseBuilder } from "./responseBuilder";
import { SessionManager } from "./sessionManager";
import { WhatsAppService } from "./whatsappService";

export class MessageHandler {
  private intentParser: IntentParser;
  private responseBuilder: ResponseBuilder;
  private sessionManager: SessionManager;
  private whatsappService: WhatsAppService;

  constructor() {
    this.intentParser = new IntentParser();
    this.responseBuilder = new ResponseBuilder();
    this.sessionManager = new SessionManager();
    this.whatsappService = new WhatsAppService();
  }

  /**
   * Process incoming WhatsApp message
   */
  async processMessage(
    message: WhatsAppMessage,
    contact?: { name: string; wa_id: string }
  ): Promise<void> {
    try {
      logger.info(
        `Processing message from ${message.from}: ${message.text?.body}`
      );

      // Get or create user
      const user = await this.getOrCreateUser(message.from, contact?.name);

      // Get or create session
      const session = await this.sessionManager.getOrCreateSession(
        user.id,
        message.from
      );

      // Create message context
      const context: MessageContext = {
        message,
        user,
        session,
        contact,
      };

      // Parse user intent
      const intent = await this.intentParser.parseIntent(
        message.text?.body || "",
        context
      );

      // Handle the intent
      const response = await this.handleIntent(intent, context);

      // Send response
      await this.whatsappService.sendMessage(message.from, response);

      // Update session
      await this.sessionManager.updateSession(session.userId, {
        lastActivity: new Date(),
        messageCount: session.messageCount + 1,
      });
    } catch (error) {
      logger.error("Error processing message:", error);

      // Send error message to user
      await this.whatsappService.sendMessage(
        message.from,
        MESSAGE_TEMPLATES.ERROR_GENERIC
      );
    }
  }

  /**
   * Handle parsed intent
   */
  private async handleIntent(
    intent: any,
    context: MessageContext
  ): Promise<string> {
    const { type, data } = intent;
    const { user } = context;

    switch (type) {
      case "GREETING":
      case "HELP":
        return MESSAGE_TEMPLATES.HELP;

      case "CREATE_CARD":
        return await this.handleCreateCard(user!);

      case "CHECK_BALANCE":
        return await this.handleCheckBalance(user!);

      case "LIST_CARDS":
        return await this.handleListCards(user!);

      case "SEND_MONEY":
        return await this.handleSendMoney(user!, data);

      case "DEPOSIT":
        return await this.handleDeposit(user!);

      case "TRANSACTION_HISTORY":
        return await this.handleTransactionHistory(user!);

      case "PROFILE":
        return await this.handleProfile(user!);

      case "SET_BASENAME":
        return await this.handleSetBasename(user!, data);

      case "CHECK_BASENAME":
        return await this.handleCheckBasename(data);

      case "BUY_CNGN":
        return await this.handleBuyCngn(user!, data);

      case "WITHDRAW":
        return await this.handleWithdraw(user!, data);

      case "BANK_ACCOUNT":
        return await this.handleBankAccount(user!);

      default:
        return MESSAGE_TEMPLATES.ERROR_INVALID_COMMAND;
    }
  }

  /**
   * Get or create user from WhatsApp number
   */
  private async getOrCreateUser(whatsappNumber: string, contactName?: string) {
    try {
      // Try to find existing user
      let user = await UserService.findByWhatsAppNumber(whatsappNumber);

      if (!user) {
        // Create new user
        user = await UserService.createUser(whatsappNumber);

        // Send personalized welcome message
        const welcomeMessage = contactName
          ? MESSAGE_TEMPLATES.PERSONALIZED_WELCOME(contactName)
          : MESSAGE_TEMPLATES.WELCOME;

        await this.whatsappService.sendMessage(whatsappNumber, welcomeMessage);
      }

      return user;
    } catch (error) {
      logger.error("Error getting/creating user:", error);
      throw error;
    }
  }

  /**
   * Handle create card intent
   */
  private async handleCreateCard(user: any): Promise<string> {
    try {
      const result = await CardService.createCard(user.id);

      if (result.success) {
        return MESSAGE_TEMPLATES.CARD_CREATED(
          result.data.cardNumber,
          user.walletAddress
        );
      } else {
        return `❌ Failed to create card: ${result.error}`;
      }
    } catch (error) {
      logger.error("Error creating card:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle check balance intent
   */
  private async handleCheckBalance(user: any): Promise<string> {
    try {
      const balance = await CardService.getTotalBalance(user.id);
      const cardCount = await CardService.getCardCount(user.id);

      return MESSAGE_TEMPLATES.BALANCE_INFO(balance, cardCount);
    } catch (error) {
      logger.error("Error checking balance:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle list cards intent
   */
  private async handleListCards(user: any): Promise<string> {
    try {
      const cards = await CardService.getUserCards(user.id);

      if (cards.length === 0) {
        return `📱 You don't have any cards yet.\n\nType *create card* to get started!`;
      }

      let response = `💳 *Your Virtual Cards*\n\n`;

      cards.forEach((card, index) => {
        response += `${index + 1}. Card ${card.cardNumber.slice(-4)}\n`;
        response += `   Balance: ${card.cnmgBalance} cNGN\n`;
        response += `   Status: ${card.status}\n\n`;
      });

      return response;
    } catch (error) {
      logger.error("Error listing cards:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle send money intent
   */
  private async handleSendMoney(user: any, data: any): Promise<string> {
    try {
      const { amount, recipient } = data;

      const result = await CardService.sendMoney(user.id, amount, recipient);

      if (result.success) {
        return MESSAGE_TEMPLATES.TRANSACTION_SUCCESS(
          amount,
          recipient,
          result.txHash || ""
        );
      } else {
        if (result.error?.includes("Insufficient")) {
          return MESSAGE_TEMPLATES.ERROR_INSUFFICIENT_BALANCE;
        }
        return `❌ Transfer failed: ${result.error}`;
      }
    } catch (error) {
      logger.error("Error sending money:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle deposit intent
   */
  private async handleDeposit(user: any): Promise<string> {
    try {
      // Generate on-ramp link or show deposit address
      const depositInfo = await CardService.getDepositInfo(user.id);

      return `💰 *Deposit cNGN to Your Wallet*

Your deposit address:
\`${user.walletAddress}\`

You can:
1. Transfer cNGN from another wallet
2. Use an on-ramp service to buy cNGN
3. Receive cNGN from friends

⚠️ Only send cNGN tokens to this address on Base network.`;
    } catch (error) {
      logger.error("Error handling deposit:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle transaction history intent
   */
  private async handleTransactionHistory(user: any): Promise<string> {
    try {
      const transactions = await CardService.getRecentTransactions(user.id, 5);

      if (transactions.length === 0) {
        return `📊 No transactions found.\n\nStart by creating a card and making your first transaction!`;
      }

      let response = `📊 *Recent Transactions*\n\n`;

      transactions.forEach((tx, index) => {
        const date = new Date(tx.createdAt).toLocaleDateString();
        response += `${index + 1}. ${tx.type} - ${tx.amount} ${tx.currency}\n`;
        response += `   ${tx.status} • ${date}\n`;
        if (tx.description) {
          response += `   ${tx.description}\n`;
        }
        response += `\n`;
      });

      return response;
    } catch (error) {
      logger.error("Error getting transaction history:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle profile intent
   */
  private async handleProfile(user: any): Promise<string> {
    try {
      const cardCount = await CardService.getCardCount(user.id);
      const totalBalance = await CardService.getTotalBalance(user.id);

      let response = `👤 *Your Profile*\n\n`;
      response += `📱 WhatsApp: ${user.whatsappNumber}\n`;
      response += `💳 Wallet: \`${user.walletAddress}\`\n`;

      if (user.basename) {
        response += `🏷️ Basename: ${user.basename}\n`;
      }

      response += `💰 Total Balance: ${totalBalance} cNGN\n`;
      response += `🎴 Cards: ${cardCount}\n`;
      response += `📅 Joined: ${new Date(
        user.createdAt
      ).toLocaleDateString()}\n`;

      return response;
    } catch (error) {
      logger.error("Error getting profile:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle set basename intent
   */
  private async handleSetBasename(user: any, data: any): Promise<string> {
    try {
      const { basename } = data;

      if (!basename) {
        return `❌ Please provide a basename. Example: "set basename alice"`;
      }

      // Format basename properly
      const formattedBasename = BasenameService.formatBasename(basename);

      // Check if basename is valid format
      if (!BasenameService.isValidBasename(formattedBasename)) {
        return `❌ Invalid basename format. Use format: "yourname.basetest.eth"`;
      }

      // Check if basename is available/registered
      const isRegistered = await BasenameService.isBasenameRegistered(
        formattedBasename
      );
      if (!isRegistered) {
        return `❌ Basename "${formattedBasename}" is not registered yet. Please register it first at https://www.base.org/names`;
      }

      // Resolve basename to check ownership
      const resolved = await BasenameService.resolveBasename(formattedBasename);
      if (!resolved.isValid) {
        return `❌ Could not resolve basename "${formattedBasename}". Please try again.`;
      }

      // Check if user owns this basename
      if (resolved.address.toLowerCase() !== user.walletAddress.toLowerCase()) {
        return `❌ You don't own "${formattedBasename}". It belongs to ${resolved.address.slice(
          0,
          6
        )}...${resolved.address.slice(-4)}`;
      }

      // Update user's basename
      const success = await UserService.updateBasename(
        user.id,
        formattedBasename
      );

      if (success) {
        return `✅ *Basename Set Successfully!*

🏷️ Your basename: ${formattedBasename}
💳 Wallet: ${user.walletAddress}

Now people can send you cNGN using your basename instead of your wallet address!`;
      } else {
        return `❌ Failed to set basename. Please try again.`;
      }
    } catch (error) {
      logger.error("Error setting basename:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle check basename availability
   */
  private async handleCheckBasename(data: any): Promise<string> {
    try {
      const { basename } = data;

      if (!basename) {
        return `❌ Please provide a basename to check. Example: "check basename alice"`;
      }

      const formattedBasename = BasenameService.formatBasename(basename);

      // Check if basename is valid format
      if (!BasenameService.isValidBasename(formattedBasename)) {
        return `❌ Invalid basename format. Use format: "yourname.basetest.eth"`;
      }

      // Check if basename is registered
      const resolved = await BasenameService.resolveBasename(formattedBasename);

      if (resolved.isValid) {
        return `🔍 *Basename Check Results*

🏷️ Name: ${formattedBasename}
📍 Status: ✅ Registered
💳 Owner: ${resolved.address.slice(0, 6)}...${resolved.address.slice(-4)}

This basename is already taken.`;
      } else {
        // Generate suggestions
        const suggestions =
          BasenameService.generateBasenameVariations(basename);
        const availabilityChecks = await BasenameService.checkMultipleBasenames(
          suggestions
        );

        let response = `🔍 *Basename Check Results*

🏷️ Name: ${formattedBasename}
📍 Status: ❌ Not registered

💡 *Available alternatives:*\n`;

        availabilityChecks.forEach((check, index) => {
          const status = check.available ? "✅ Available" : "❌ Taken";
          response += `${index + 1}. ${check.name} - ${status}\n`;
        });

        response += `\nRegister at: https://www.base.org/names`;

        return response;
      }
    } catch (error) {
      logger.error("Error checking basename:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle buy cNGN intent (on-ramp)
   */
  private async handleBuyCngn(user: any, data: any): Promise<string> {
    try {
      const amount = data?.amount || "10000"; // Default 10,000 NGN

      const onRampResult = await OnRampService.generateOnRampUrl({
        userId: user.walletAddress,
        amount,
        currency: "NGN",
        returnUrl: `${process.env.BASE_URL}/onramp/success`,
      });

      if (onRampResult.success && onRampResult.url) {
        return `💰 *Buy cNGN with Naira*

Amount: ₦${amount}
You'll receive: ${amount} cNGN

Click here to complete purchase:
${onRampResult.url}

💡 *What happens next:*
1. Complete payment with your bank
2. cNGN will be sent to your wallet
3. You'll get a confirmation message

⚠️ Only use the official link above for security.`;
      } else {
        return `❌ Unable to generate purchase link: ${onRampResult.error}

Please try again or contact support.`;
      }
    } catch (error) {
      logger.error("Error handling buy cNGN:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle withdraw intent (off-ramp)
   */
  private async handleWithdraw(user: any, data: any): Promise<string> {
    try {
      if (!data?.amount) {
        return `💸 *Withdraw cNGN to Bank*

To withdraw, specify an amount:
Example: "withdraw 50000"

Current balance: ${await CardService.getTotalBalance(user.id)} cNGN

Supported banks: GTB, Access, UBA, Zenith, First Bank, and more.

Need to add your bank account? Type "bank account"`;
      }

      const amount = data.amount;
      const fees = OffRampService.calculateOffRampFee(amount);

      return `💸 *Withdraw ${amount} cNGN*

Amount: ${fees.amount} cNGN
Fee: ${fees.fee} NGN (1.5%)
You'll receive: ₦${fees.netAmount}

To proceed, I need your bank details:
• Account number
• Bank name
• Account holder name

Type "bank account" to add your details, then try withdrawing again.

⏱️ Processing time: 1-3 business days`;
    } catch (error) {
      logger.error("Error handling withdraw:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle bank account setup
   */
  private async handleBankAccount(user: any): Promise<string> {
    try {
      const banks = await OffRampService.getSupportedBanks();
      const bankList = banks
        .slice(0, 10)
        .map((bank, index) => `${index + 1}. ${bank.name}`)
        .join("\n");

      return `🏦 *Add Bank Account*

To withdraw cNGN to your bank account, I need:

1️⃣ *Account Number* (10 digits)
2️⃣ *Bank Name* 
3️⃣ *Account Holder Name*

*Supported Banks:*
${bankList}
...and more

*Example:*
"My bank is GTB, account 0123456789, John Doe"

Once added, you can withdraw with:
"withdraw 50000"

🔒 Your bank details are encrypted and secure.`;
    } catch (error) {
      logger.error("Error handling bank account:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }
}
