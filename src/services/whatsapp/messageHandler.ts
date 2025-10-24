import { WhatsAppMessage, MessageContext } from "@/types/whatsapp.types";
import { UserService } from "../user/userService";
import { CardService } from "../card/cardService";
import { BasenameService } from "../blockchain/basenameService";
import { OnRampService } from "../payment/onRampService";
import { IntegratedOffRampService } from "../payment/integratedOffRampService";
import { MockFiatService } from "../payment/mockFiatService";
import { KYCService } from "../kyc/kycService";
import { PinService } from "../security/pinService";
import { flutterwaveService } from "../payment/flutterwaveService";
import { logger } from "@/utils/logger";
import { MESSAGE_TEMPLATES } from "@/config/whatsapp";
import { IntentParser } from "./intentParser";
import { ResponseBuilder } from "./responseBuilder";
import { SessionManager, UserSession } from "./sessionManager";
import { FlowHandler } from "./flowHandler";
import { WhatsAppService } from "./whatsappService";

export class MessageHandler {
  private intentParser: IntentParser;
  private responseBuilder: ResponseBuilder;
  private whatsappService: WhatsAppService;

  constructor() {
    this.intentParser = new IntentParser();
    this.responseBuilder = new ResponseBuilder();
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
      const session = SessionManager.getOrCreateSession(user.id, message.from);

      // Add input validation and sanitization
      const messageText = (message.text?.body || "")
        .trim()
        .substring(0, 1000) // Limit length
        .replace(/[<>]/g, ""); // Remove potential XSS chars

      if (!messageText) {
        await this.whatsappService.sendMessage(
          message.from,
          "❌ Empty message received. Please try again."
        );
        return;
      }

      // Handle PIN verification
      if (SessionManager.isAwaitingPin(message.from)) {
        if (/^\d{4}$/.test(messageText)) {
          const pinResult = await FlowHandler.handlePinVerification(
            message.from,
            messageText,
            session
          );

          if (pinResult.success && pinResult.shouldProceed) {
            const transactionResult =
              await FlowHandler.processPendingTransaction(session);
            await this.whatsappService.sendMessage(
              message.from,
              transactionResult
            );
            return;
          } else {
            await this.whatsappService.sendMessage(
              message.from,
              pinResult.message
            );
            return;
          }
        } else if (messageText.toLowerCase() === "cancel") {
          SessionManager.clearAwaitingPin(message.from);
          await this.whatsappService.sendMessage(
            message.from,
            "❌ Transaction cancelled. Type 'help' to see available commands."
          );
          return;
        } else {
          await this.whatsappService.sendMessage(
            message.from,
            "❌ Please enter a valid 4-digit PIN or type 'cancel' to abort."
          );
          return;
        }
      }

      // Handle active flows
      if (SessionManager.isInFlow(message.from)) {
        let flowResponse = "";

        if (messageText.toLowerCase() === "cancel") {
          SessionManager.cancelFlow(message.from);
          flowResponse =
            "❌ Operation cancelled. Type 'help' to see available commands.";
        } else {
          switch (session.currentFlow) {
            case "PIN_SETUP":
              flowResponse = await FlowHandler.handlePinSetupFlow(
                message.from,
                messageText,
                session
              );
              break;
            case "KYC_VERIFICATION":
              flowResponse = await FlowHandler.handleKYCFlow(
                message.from,
                messageText,
                session
              );
              break;
            case "PIN_RESET":
              flowResponse = await FlowHandler.handlePinResetFlow(
                message.from,
                messageText,
                session
              );
              break;
            default:
              SessionManager.completeFlow(message.from);
              flowResponse = "❌ Unknown flow. Please try again.";
          }
        }

        await this.whatsappService.sendMessage(message.from, flowResponse);
        return;
      }

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

      // Debug log for intent
      logger.info(
        `Parsed intent: ${intent.type} for message: "${messageText}"`
      );

      // Handle the intent
      const response = await this.handleIntent(intent, context);

      // Send response
      await this.whatsappService.sendMessage(message.from, response);
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
        return await this.getContextualHelp(user!);

      case "CREATE_CARD":
        return await this.handleCreateCard(user!);

      case "CHECK_BALANCE":
        return await this.handleCheckBalance(user!);

      case "LIST_CARDS":
        return await this.handleListCards(user!);

      case "VIEW_CARD":
        return await this.handleViewCard(user!);

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

      case "SUBMIT_KYC":
        return await this.handleSubmitKYC(user!, data);

      case "BUY_USDC":
        return await this.handleBuyUSDC(user!, data);

      case "BUY_USDT":
        return await this.handleBuyUSDT(user!, data);

      case "BUY_CRYPTO":
        return await this.handleBuyCrypto(user!);

      case "BUY_AMOUNT":
        return await this.handleBuyAmount(user!, data);

      case "ADD_BANK":
        return await this.handleAddBank(user!, data);

      case "CASH_OUT":
        return await this.handleCashOut(user!, data);

      case "BUY_WITH_BANK":
        return await this.handleBuyWithBank(user!, data);

      case "CONFIRM_PAYMENT":
        return await this.handleConfirmPayment(user!, data);

      case "SETUP_PIN":
        return await this.handleSetupPin(user!);

      case "RESET_PIN":
        return await this.handleResetPin(user!);

      case "CANCEL":
        return this.handleCancel();

      default:
        logger.warn(
          `Unknown intent: ${type} for message: "${context.message.text?.body}"`
        );
        return `❓ I didn't understand "${context.message.text?.body}".

Type "help" to see all available commands.

*Quick commands:*
• balance - Check your crypto
• history - View transactions  
• create card - Get virtual card
• buy cngn - Buy crypto`;
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
        logger.info(`Creating new user for WhatsApp number: ${whatsappNumber}`);

        // Create new user
        user = await UserService.createUser(whatsappNumber);

        logger.info(`User created successfully: ${user.id}`);

        // Send personalized welcome message
        const welcomeMessage = contactName
          ? MESSAGE_TEMPLATES.PERSONALIZED_WELCOME(contactName)
          : MESSAGE_TEMPLATES.WELCOME;

        await this.whatsappService.sendMessage(whatsappNumber, welcomeMessage);
      } else {
        logger.info(`Existing user found: ${user.id}`);
      }

      return user;
    } catch (error) {
      logger.error("Error getting/creating user:", error);

      // Send user-friendly error message
      await this.whatsappService.sendMessage(
        whatsappNumber,
        "❌ Sorry, there was an issue setting up your account. Please try again in a few moments. If the problem persists, contact support."
      );

      throw error;
    }
  }

  /**
   * Enhanced create card with PIN and KYC checks - FIXED
   */
  private async handleCreateCard(user: any): Promise<string> {
    try {
      // Check KYC status first - FIXED to read from database
      const kycStatus = await UserService.getKYCStatus(user.id);

      if (!kycStatus.canCreateCard) {
        return `🔒 *KYC Required*

To create a virtual card, you need to complete KYC first.

Type "submit kyc" to start verification.

*Why KYC?*
• Security and compliance
• Higher transaction limits
• Access to all features

*Takes only 2 minutes!* ⏱️`;
      }

      // Check PIN setup
      const hasPinSetup = await PinService.hasPinSetup(user.id);
      if (!hasPinSetup) {
        return `🔐 *Transaction PIN Required*

For security, you need to set up a transaction PIN before creating cards.

Type "setup pin" to secure your account.

*Why PIN?*
• Protects your transactions
• Prevents unauthorized access
• Required for all operations

*Setup takes 1 minute!* ⏱️`;
      }

      const result = await CardService.createCard(user.id);

      if (result.success) {
        return `🎉 *Virtual Card Created Successfully!*

💳 Card Number: ****${result.data.cardNumber.slice(-4)}
🏷️ Card Type: ${result.data.brand?.toUpperCase() || "VISA"}
💰 Balance: 0 cNGN (empty)
📱 Status: Active

*Next Steps:*
1. 💰 Fund card: "buy 10000" (₦10,000 cNGN)
2. 👀 View details: "view card"
3. 📊 Check balance: "balance"

*After funding:*
• Send money: "send 1000 to alice.base.eth"
• Withdraw: "withdraw 5000"

Your card is ready! 🚀`;
      } else {
        if (
          result.error?.includes("KYC") ||
          result.error?.includes("verification")
        ) {
          return `🔒 *Verification Required*

${result.error}

Type "submit kyc" to complete your verification and create your card.`;
        }
        return `❌ Failed to create card: ${result.error}`;
      }
    } catch (error) {
      logger.error("Error creating card:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle check balance intent - Multi-token support (cNGN + USDC)
   */
  private async handleCheckBalance(user: any): Promise<string> {
    try {
      // Get balances for available tokens
      const balances = {
        cngn: 0,
        usdc: 0,
        cardCount: 0,
      };

      if (user.walletAddress) {
        // Get cNGN balance
        try {
          const { CngnService } = await import("../blockchain/cngnService");
          const cngnBalance = await CngnService.getBalance(user.walletAddress);
          balances.cngn = parseFloat(cngnBalance.balance);
          logger.info(`Retrieved cNGN balance: ${balances.cngn}`);
        } catch (error) {
          logger.warn("Failed to get cNGN balance:", error);
        }

        // Get USDC balance
        try {
          const { ethers } = await import("ethers");
          const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
          const usdcContract = new ethers.Contract(
            "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC
            ["function balanceOf(address) view returns (uint256)"],
            provider
          );
          const usdcBalance = await usdcContract.balanceOf(user.walletAddress);
          balances.usdc = parseFloat(ethers.formatUnits(usdcBalance, 6)); // USDC has 6 decimals
          logger.info(`Retrieved USDC balance: ${balances.usdc}`);
        } catch (error) {
          logger.warn("Failed to get USDC balance:", error);
        }
      }

      // Get card count
      balances.cardCount = await CardService.getCardCount(user.id);

      return this.formatMultiTokenBalanceResponse(balances);
    } catch (error) {
      logger.error("Error checking balance:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Format multi-token balance response
   */
  private formatMultiTokenBalanceResponse(balances: {
    cngn: number;
    usdc: number;
    cardCount: number;
  }): string {
    const totalValue = balances.cngn + balances.usdc * 1600; // Rough NGN conversion for display

    if (balances.cngn === 0 && balances.usdc === 0) {
      return `💰 *Your Portfolio*

🇳🇬 cNGN: 0 (₦0)
💵 USDC: 0 ($0)
💳 Active Cards: ${balances.cardCount}

*Get started:*
• Buy cNGN: "buy 10000"
• Buy USDC: "buy usdc"
• Create card: "create card"

*Supported tokens:* cNGN (Nigerian Naira) and USDC (US Dollar) on Base Sepolia`;
    }

    let response = `💰 *Your Portfolio*\n\n`;

    if (balances.cngn > 0) {
      response += `🇳🇬 cNGN: ${balances.cngn.toLocaleString()} (₦${balances.cngn.toLocaleString()})\n`;
    }

    if (balances.usdc > 0) {
      response += `💵 USDC: ${balances.usdc.toLocaleString()} ($${balances.usdc.toLocaleString()})\n`;
    }

    response += `💳 Active Cards: ${balances.cardCount}\n\n*Available actions:*\n• Send cNGN: "send 1000 to alice.base.eth"\n• Send USDC: "send 50 usdc to alice.base.eth"\n• Create card: "create card"\n• View history: "history"`;

    return response;
  }

  /**
   * Handle list cards intent
   */
  private async handleListCards(user: any): Promise<string> {
    try {
      const cards = await CardService.getUserCards(user.id);

      if (cards.length === 0) {
        return `📱 You don't have any cards yet.

Type "create card" to get started!`;
      }

      let response = `💳 *Your Virtual Cards*

`;

      cards.forEach((card, index) => {
        response += `${index + 1}. Card ****${card.cardNumber.slice(-4)}
   Balance: ${card.cNGNBalance} cNGN
   Status: ${card.status}

`;
      });

      response += `*Actions:*
• View card details: "view card"
• Fund card: "buy cngn"
• Check balance: "balance"`;

      return response;
    } catch (error) {
      logger.error("Error listing cards:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle view card details intent
   */
  private async handleViewCard(user: any): Promise<string> {
    try {
      const cards = await CardService.getUserCards(user.id);

      if (cards.length === 0) {
        return `📱 You don't have any cards yet.

Type "create card" to get started!`;
      }

      // Get the most recent card
      const card = cards[0];
      const cardMetadata = card.metadata as any;
      const mockData = cardMetadata?.cardData || cardMetadata;

      return `💳 *Your Virtual Card Details*

🎴 Card Number: ${card.cardNumber}
📅 Expiry: ${mockData?.expiryMonth || "12"}/${mockData?.expiryYear || "28"}
🔒 CVV: ${mockData?.cvv || "123"}
🏷️ Type: ${mockData?.brand?.toUpperCase() || "VISA"}
💰 Balance: ${card.cNGNBalance} cNGN
📱 Status: ${card.status}

*Security Notice:*
⚠️ Keep these details private
⚠️ Never share CVV with anyone
⚠️ Use only on trusted websites

*Actions:*
• Fund card: "buy cngn"
• Check balance: "balance"
• View transactions: "history"`;
    } catch (error) {
      logger.error("Error viewing card details:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle transaction history intent - FIXED
   */
  private async handleTransactionHistory(user: any): Promise<string> {
    try {
      const transactions = await CardService.getRecentTransactions(user.id, 10);

      if (transactions.length === 0) {
        return `📊 *Transaction History*

No transactions yet. Get started:

*💰 First Steps:*
• Buy crypto: "buy cngn" or "buy 10000"
• Create card: "create card"
• Check balance: "balance"

*💸 After funding:*
• Send money: "send 1000 to alice.base.eth"
• Withdraw: "withdraw 5000"

Your transactions will appear here once you start! 🚀`;
      }

      let response = `📊 *Transaction History*

`;

      transactions.forEach((tx, index) => {
        const date = new Date(tx.createdAt).toLocaleDateString();
        const time = new Date(tx.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        // Format transaction type
        let typeIcon = "💰";
        if (tx.type === "DEPOSIT" || tx.type === "ONRAMP") typeIcon = "💰";
        if (tx.type === "WITHDRAWAL" || tx.type === "OFFRAMP") typeIcon = "💸";
        if (tx.type === "TRANSFER") typeIcon = "📤";
        if (tx.type === "PAYMENT") typeIcon = "💳";

        response += `${typeIcon} ${tx.type}
💵 ${tx.amount} ${tx.currency || "cNGN"}
📅 ${date} ${time}
✅ ${tx.status}`;

        if (tx.description) {
          response += `
📝 ${tx.description}`;
        }

        if (tx.txHash) {
          response += `
🔗 ${tx.txHash.slice(0, 10)}...`;
        }

        response += `

`;
      });

      response += `*Actions:*
• Buy more: "buy cngn"
• Send money: "send [amount] to [address]"
• Check balance: "balance"`;

      return response;
    } catch (error) {
      logger.error("Error getting transaction history:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle Submit KYC - Updated name and flow
   */
  private async handleSubmitKYC(user: any, data: any): Promise<string> {
    try {
      const kycStatus = await UserService.getKYCStatus(user.id);

      if (kycStatus.verified) {
        return `✅ *KYC Already Completed*

Your identity is already verified!
Status: ${kycStatus.level}

You can now:
• Create virtual cards: "create card"
• Buy crypto: "buy cngn"
• Send money: "send [amount] to [address]"

${
  (await PinService.hasPinSetup(user.id))
    ? 'Type "create card" to get started! 🚀'
    : 'Set up your PIN first: "setup pin"'
}`;
      }

      // Start KYC flow
      SessionManager.startFlow(user.whatsappNumber, "KYC_VERIFICATION");

      return `🆔 *Submit KYC - Identity Verification*

To comply with regulations and secure your account, I need to verify your identity.

*Benefits after verification:*
✅ Create virtual cards
✅ Higher transaction limits  
✅ Buy/sell crypto
✅ Send money globally

Please enter your *full name* (First Last):
Example: "John Doe"`;
    } catch (error) {
      logger.error("Error handling KYC verification:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle buy cNGN intent (on-ramp) - Improved UX
   */
  private async handleBuyCngn(user: any, data: any): Promise<string> {
    try {
      const amount = data?.amount || "10000"; // Default 10,000 NGN
      const amountNum = parseFloat(amount);

      // Validate amount
      if (amountNum < 100) {
        return "❌ Minimum purchase is ₦100";
      }

      if (amountNum > 1000000) {
        return "❌ Maximum purchase is ₦1,000,000";
      }

      // Use IntegratedOnRampService for complete flow
      const { IntegratedOnRampService } = await import(
        "../payment/integratedOnRampService"
      );

      const result = await IntegratedOnRampService.depositNGN({
        userId: user.id,
        amountNGN: amountNum,
        paymentMethod: "BANK_TRANSFER",
      });

      if (result.success) {
        return `💰 *Buy ${amountNum.toLocaleString()} cNGN*

💳 Cost: ₦${amountNum.toLocaleString()} NGN
🪙 You'll receive: ${amountNum.toLocaleString()} cNGN
🔗 Rate: 1 NGN = 1 cNGN (no fees!)

${result.paymentInstructions}

*After making the bank transfer:*
Type "paid ${amount}" to confirm your payment

⚠️ Transfer the exact amount: ₦${amountNum.toLocaleString()}`;
      } else {
        return `❌ Failed to create payment: ${result.error}

Try again with: "buy cngn"`;
      }
    } catch (error) {
      logger.error("Error handling buy cNGN:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle Buy Crypto - Show available options
   */
  private async handleBuyCrypto(user: any): Promise<string> {
    try {
      return `💰 *Buy Crypto*

*Available on Base Sepolia:*

🇳🇬 *cNGN (Nigerian Naira Token)*
• Pay with: Bank transfer (NGN)
• Rate: 1 NGN = 1 cNGN
• Command: "buy cngn" or "buy 10000"

💵 *USDC (USD Coin)*
• Pay with: Card, Bank transfer (USD)
• Rate: 1 USD = 1 USDC
• Command: "buy usdc"

*Not Available:*
💰 USDT (Tether) - Not on Base Sepolia

*Quick Start:*
• "buy 10000" - Buy ₦10,000 cNGN (Nigerians)
• "buy usdc" - Buy USD Coin (International)

*Choose based on your location:*
🇳🇬 Nigeria → cNGN
🌍 International → USDC`;
    } catch (error) {
      logger.error("Error handling buy crypto:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle Buy Amount - Default to cNGN for Nigerian users
   */
  private async handleBuyAmount(user: any, data: any): Promise<string> {
    try {
      const amount = data?.amount || "10000";

      // Default to cNGN for amount-only purchases (Nigerian focus)
      return await this.handleBuyCngn(user, { amount });
    } catch (error) {
      logger.error("Error handling buy amount:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle setup PIN
   */
  private async handleSetupPin(user: any): Promise<string> {
    try {
      const hasPinSetup = await PinService.hasPinSetup(user.id);
      if (hasPinSetup) {
        return `✅ *PIN Already Set Up*

Your transaction PIN is already configured.

You can:
• Create cards: "create card"
• Buy crypto: "buy cngn"
• Reset PIN: "reset pin"

Type "create card" to get started! 🚀`;
      }

      // Start PIN setup flow
      SessionManager.startFlow(user.whatsappNumber, "PIN_SETUP");

      return `🔐 *Set Up Your Transaction PIN*

Your PIN secures all transactions and sensitive operations.

*PIN Requirements:*
• Exactly 4 digits
• No repeated numbers (1111, 2222, etc.)
• No sequential numbers (1234, 4321, etc.)

Please enter your 4-digit PIN:`;
    } catch (error) {
      logger.error("Error handling PIN setup:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Get contextual help based on user's progress
   */
  private async getContextualHelp(user: any): Promise<string> {
    try {
      const kycStatus = await UserService.getKYCStatus(user.id);
      const hasPinSetup = await PinService.hasPinSetup(user.id);
      const cardCount = await CardService.getCardCount(user.id);

      // New user - needs KYC
      if (!kycStatus.verified) {
        return `🎉 *Welcome to Nelo!*

Your Web3 financial assistant for Nigeria 🇳🇬

*🚀 Let's get you started (2 minutes):*
1. Submit KYC: "submit kyc"
2. Set security PIN: "setup pin"  
3. Create virtual card: "create card"
4. Buy crypto: "buy cngn"

Type "submit kyc" to begin! ✨`;
      }

      // KYC done, needs PIN
      if (!hasPinSetup) {
        return `✅ *KYC Verified!*

Next step: Set up your security PIN

*🔐 Security Setup:*
• Set PIN: "setup pin"

*After PIN setup:*
• Create card: "create card"
• Buy crypto: "buy cngn"

Type "setup pin" to continue! 🔒`;
      }

      // KYC + PIN done, needs card
      if (cardCount === 0) {
        return `🔒 *Account Secured!*

Ready to create your virtual card?

*💳 Next Steps:*
• Create card: "create card"
• Buy crypto: "buy cngn"
• Check balance: "balance"

Type "create card" to get started! 🚀`;
      }

      // Fully set up user
      return `🤖 *Nelo - Ready to Use!*

*💰 Buy & Manage Crypto:*
• buy cngn - Buy Nigerian Naira (cNGN)
• buy usdc - Buy USD Coin
• balance - Check your portfolio

*💳 Cards & Payments:*
• my cards - View your cards
• view card - See card details
• send 1000 to alice.base.eth

*🏦 Banking:*
• add bank - Link Nigerian bank
• withdraw 5000 - Cash out to bank

*📊 Account:*
• history - View transactions
• profile - Your account info

*🏷️ Basename:*
• set basename alice.base.eth
• check basename alice.base.eth

Need help with anything specific? 💬`;
    } catch (error) {
      logger.error("Error getting contextual help:", error);
      return MESSAGE_TEMPLATES.HELP;
    }
  }

  /**
   * Handle other methods with simple responses for now
   */
  private async handleSendMoney(user: any, data: any): Promise<string> {
    try {
      if (!data || !data.amount || !data.recipient) {
        return `💸 *Send Money*

Send crypto to anyone on Base network:

*Format:*
"send [amount] to [address/basename]"

*Examples:*
• send 1000 to alice.base.eth
• send 50 usdc to 0x1234...
• send 100 to bob.base.eth

*Supported tokens:* cNGN, USDC`;
      }

      // Check KYC status
      const kycStatus = await UserService.getKYCStatus(user.id);
      if (!kycStatus.verified) {
        return `🔒 *KYC Required for Transfers*

Complete KYC verification first to send money.

Type "submit kyc" to get started.`;
      }

      // Check PIN setup
      const hasPinSetup = await PinService.hasPinSetup(user.id);
      if (!hasPinSetup) {
        return `🔐 *PIN Required for Transfers*

Set up your security PIN first to send money.

Type "setup pin" to secure your account.`;
      }

      const { amount, recipient, token = "cngn" } = data;

      // Validate amount
      const amountMatch = amount.match(/(\d+(?:\.\d+)?)/);
      if (!amountMatch) {
        return `❌ Invalid amount format.
Example: "send 1000 to alice.base.eth"`;
      }

      const amountValue = amountMatch[1];

      // Use secure transaction flow (requires PIN)
      return await FlowHandler.handleSecureTransaction(
        user.whatsappNumber,
        "SEND_MONEY",
        {
          amount: amountValue,
          recipient,
          token: token.toLowerCase(),
        },
        SessionManager.getSession(user.whatsappNumber)!
      );
    } catch (error) {
      logger.error("Error handling send money:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  private async handleDeposit(user: any): Promise<string> {
    return `💰 *Deposit Crypto*

Your wallet address:
\`${user.walletAddress}\`

You can:
1. Buy cNGN: "buy cngn"
2. Transfer from another wallet
3. Receive from friends

⚠️ Only send cNGN tokens to this address on Base network.`;
  }

  private async handleProfile(user: any): Promise<string> {
    try {
      const cardCount = await CardService.getCardCount(user.id);
      const kycStatus = await UserService.getKYCStatus(user.id);
      const hasPinSetup = await PinService.hasPinSetup(user.id);

      return `👤 *Your Profile*

📱 WhatsApp: ${user.whatsappNumber}
🏷️ Name: ${user.firstName || "Not set"} ${user.lastName || ""}
💳 Wallet Address:
\`${user.walletAddress}\`

🎴 Cards: ${cardCount}
🆔 KYC: ${kycStatus.verified ? "✅ Verified" : "❌ Not Verified"}
🔐 PIN: ${hasPinSetup ? "✅ Set Up" : "❌ Not Set Up"}
🏷️ Basename: ${user.basename || "Not set"}
📅 Joined: ${new Date(user.createdAt).toLocaleDateString()}

*💡 Tip:* Tap and hold the wallet address to copy it

*Actions:*
• Set basename: "set basename yourname.base.eth"
• Check balance: "balance"
• View cards: "my cards"`;
    } catch (error) {
      logger.error("Error getting profile:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  private async handleBuyUSDC(user: any, data: any): Promise<string> {
    try {
      const amount = data?.amount || "100"; // Default $100
      const amountNum = parseFloat(amount);

      // Validate amount
      if (amountNum < 10) {
        return "❌ Minimum purchase is $10 USDC";
      }

      if (amountNum > 10000) {
        return "❌ Maximum purchase is $10,000 USDC";
      }

      // Use OnRampService for USDC purchases
      const result = await OnRampService.initiateUSDCPurchase({
        userId: user.id,
        amountUSD: amountNum,
        paymentMethod: "CARD",
      });

      if (result.success) {
        return `💵 *Buy ${amountNum} USDC*

💰 Cost: $${amountNum} USD
🪙 You'll receive: ${amountNum} USDC
⚡ Network: Base Sepolia
🔗 Rate: 1 USD = 1 USDC

${result.paymentInstructions}

*What is USDC?*
USD Coin - A stable cryptocurrency backed 1:1 by US Dollars. Perfect for international transactions.`;
      } else {
        return `❌ Failed to initiate USDC purchase: ${result.error}

Try again with: "buy usdc"`;
      }

      return `💵 *Buy ${amountNum} USDC*

💰 Cost: $${amountNum} USD
🪙 You'll receive: ${amountNum} USDC
⚡ Network: Base Sepolia
🔗 Rate: 1 USD = 1 USDC

*Ready to purchase!*
Click the MoonPay link below to buy with your card:

*What is USDC?*
USD Coin - A stable cryptocurrency backed 1:1 by US Dollars. Perfect for international transactions.`;
    } catch (error) {
      logger.error("Error handling buy USDC:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  private async handleBuyUSDT(user: any, data: any): Promise<string> {
    return `💰 *USDT Not Available*

USDT is not deployed on Base Sepolia testnet yet.

*Available now:*
• cNGN (Nigerian Naira): "buy cngn"
• Check your balance: "balance"

*Why only cNGN?*
We're on Base Sepolia testnet where only cNGN is deployed.
USDC/USDT will be available when we move to mainnet.`;
  }

  private async handleSetBasename(user: any, data: any): Promise<string> {
    try {
      const basename = data?.basename;
      if (!basename) {
        return `🏷️ *Set Your Basename*

Basenames are human-readable addresses on Base network.

*Current wallet:*
\`${user.walletAddress}\`

*Example:* "set basename alice.base.eth"

*Benefits:*
• Easy to remember address
• Receive payments with your name
• Professional crypto identity

*Steps:*
1. Register at https://base.org/names
2. Set it here: "set basename yourname.base.eth"

*Format:* yourname.base.eth`;
      }

      // Validate basename format
      if (!BasenameService.isValidBasename(basename)) {
        return `❌ Invalid basename format.

*Correct format:* yourname.base.eth

*Examples:*
• alice.base.eth ✅
• john123.base.eth ✅
• my-name.base.eth ✅

Try: "set basename yourname.base.eth"`;
      }

      // Check if basename is available
      const isRegistered = await BasenameService.isBasenameRegistered(basename);
      if (!isRegistered) {
        return `❌ Basename "${basename}" is not registered yet.

*Next steps:*
1. 🌐 Register at: https://base.org/names
2. 🔗 Connect wallet: ${user.walletAddress.slice(0, 10)}...
3. 💰 Pay registration fee (usually ~$5)
4. ✅ Come back: "set basename ${basename}"

*Why register?*
• Own your Web3 identity
• Easy payments & transfers
• Professional crypto presence`;
      }

      // Update user basename
      const result = await UserService.updateBasename(user.id, basename);
      if (result) {
        return `🎉 *Basename Set Successfully!*

🏷️ Your basename: ${basename}
💳 Wallet: ${user.walletAddress.slice(0, 10)}...${user.walletAddress.slice(-4)}
✅ Verified and linked

*Now people can send you money using:*
"send 1000 to ${basename}"

*Much easier than:*
"send 1000 to ${user.walletAddress}"

Your Web3 identity is ready! 🚀`;
      } else {
        return `❌ Failed to set basename.

*Possible issues:*
• Basename doesn't belong to your wallet
• Network connection error
• Basename not fully registered

*Solutions:*
1. Verify ownership at https://base.org/names
2. Wait a few minutes and try again
3. Contact support if issue persists`;
      }
    } catch (error) {
      logger.error("Error setting basename:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  private async handleCheckBasename(data: any): Promise<string> {
    try {
      const basename = data?.basename;
      if (!basename) {
        return `🔍 *Check Basename Availability*

Check if a basename is available:
"check basename alice.base.eth"

*What are basenames?*
Human-readable addresses on Base network
Example: alice.base.eth instead of 0x1234...`;
      }

      // Validate format
      if (!BasenameService.isValidBasename(basename)) {
        return `❌ Invalid basename format.

Please use: yourname.base.eth
Example: "check basename alice.base.eth"`;
      }

      // Check availability
      const isRegistered = await BasenameService.isBasenameRegistered(basename);

      if (isRegistered) {
        // Try to resolve to see who owns it
        const resolved = await BasenameService.resolveBasename(basename);

        return `✅ *Basename "${basename}" is registered*

🏷️ Name: ${basename}
💳 Owner: ${resolved.address?.slice(0, 10)}...${resolved.address?.slice(-4)}
✅ Status: Active

This basename is already taken.
Try a different name or register a new one at https://base.org/names`;
      } else {
        return `🎉 *Basename "${basename}" is available!*

🏷️ Name: ${basename}
✅ Status: Available for registration

*Next steps:*
1. Register at https://base.org/names
2. Set it in Nelo: "set basename ${basename}"

*Why get a basename?*
• Easy to remember address
• Professional crypto identity
• Receive payments with your name`;
      }
    } catch (error) {
      logger.error("Error checking basename:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  private async handleWithdraw(user: any, data: any): Promise<string> {
    try {
      // Check KYC status
      const kycStatus = await UserService.getKYCStatus(user.id);
      if (!kycStatus.verified) {
        return `🔒 *KYC Required for Withdrawals*

Complete KYC verification first to withdraw funds.

Type "submit kyc" to get started.`;
      }

      // Check if user has bank account
      const bankAccounts = await UserService.getBankAccounts(user.id);
      if (bankAccounts.length === 0) {
        return `🏦 *Bank Account Required*

Add a bank account first to withdraw funds.

Type "add bank" to link your Nigerian bank account.`;
      }

      const amount = data?.amount;
      if (!amount) {
        return `💸 *Withdraw cNGN to Bank*

Enter the amount you want to withdraw:
Example: "withdraw 5000"

*Available:*
• Check balance: "balance"
• Add bank: "add bank"
• View banks: "my banks"`;
      }

      const amountNum = parseFloat(amount);
      if (amountNum < 100) {
        return `❌ Minimum withdrawal is ₦100`;
      }

      // Use IntegratedOffRampService for withdrawal
      const result = await IntegratedOffRampService.withdrawCNGN({
        userId: user.id,
        amountCNGN: amountNum,
        bankAccountId: bankAccounts[0].id, // Use first bank account
      });

      if (result.success) {
        return `✅ *Withdrawal Initiated*

💸 Amount: ${amountNum.toLocaleString()} cNGN
🏦 Bank: ${bankAccounts[0].bankName}
📋 Account: ${bankAccounts[0].accountNumber}
⏱️ Processing: ${result.estimatedTime}
🔗 Reference: ${result.withdrawalReference}

Your money is on the way! 🚀`;
      } else {
        return `❌ Withdrawal failed: ${result.error}`;
      }
    } catch (error) {
      logger.error("Error handling withdrawal:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  private async handleBankAccount(user: any): Promise<string> {
    try {
      const bankAccounts = await UserService.getBankAccounts(user.id);

      if (bankAccounts.length === 0) {
        return `🏦 *No Bank Accounts Found*

Add a bank account to withdraw funds:

"add bank [Bank Name], account [Account Number], [Account Name]"

Example:
"add bank GTBank, account 0123456789, John Doe"`;
      }

      let response = `🏦 *Your Bank Accounts*\n\n`;

      bankAccounts.forEach((account, index) => {
        response += `${index + 1}. ${account.bankName}
   Account: ${account.accountNumber}
   Name: ${account.accountName}
   Status: ${account.isVerified ? "✅ Verified" : "⏳ Pending"}

`;
      });

      response += `*Actions:*
• Withdraw: "withdraw 5000"
• Add bank: "add bank [details]"
• Check balance: "balance"`;

      return response;
    } catch (error) {
      logger.error("Error getting bank accounts:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  private async handleAddBank(user: any, data: any): Promise<string> {
    try {
      if (!data || !data.bankName) {
        return `🏦 *Add Bank Account*

Please provide your bank details in this format:
"add bank [Bank Name], account [Account Number], [Account Name]"

Example:
"add bank GTBank, account 0123456789, John Doe"

*Supported Banks:*
• GTBank, Access Bank, First Bank
• Zenith Bank, UBA, Fidelity Bank
• And all major Nigerian banks`;
      }

      const { bankName, accountNumber, accountName } = data;

      if (!bankName || !accountNumber || !accountName) {
        return `❌ Missing bank details. Please use this format:
"add bank [Bank Name], account [Account Number], [Account Name]"`;
      }

      // Mock bank code (in production, look up actual bank codes)
      const bankCode = "999"; // Mock code

      const result = await UserService.addBankAccount(
        user.id,
        accountNumber,
        bankName,
        bankCode,
        accountName
      );

      if (result.success) {
        return `✅ *Bank Account Added Successfully!*

🏦 Bank: ${bankName}
📋 Account: ${accountNumber}
👤 Name: ${accountName}
✅ Status: Verified

You can now:
• Withdraw funds: "withdraw 5000"
• View all banks: "my banks"
• Check balance: "balance"`;
      } else {
        return `❌ Failed to add bank account: ${result.error}`;
      }
    } catch (error) {
      logger.error("Error adding bank account:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  private async handleCashOut(user: any, data: any): Promise<string> {
    // Cash out is same as withdraw
    return await this.handleWithdraw(user, data);
  }

  private async handleBuyWithBank(user: any, data: any): Promise<string> {
    try {
      const amount = data?.amount;
      if (!amount) {
        return `🏦 *Buy with Bank Transfer*

Enter the amount you want to buy:
Example: "buy 10000"

*Available:*
• cNGN (Nigerian Naira): 1 NGN = 1 cNGN
• Minimum: ₦100
• Maximum: ₦1,000,000`;
      }

      const amountNum = parseFloat(amount);

      // Validate amount
      if (amountNum < 100) {
        return "❌ Minimum purchase is ₦100";
      }

      if (amountNum > 1000000) {
        return "❌ Maximum purchase is ₦1,000,000";
      }

      // Use Flutterwave for bank transfers
      const result = await flutterwaveService.initiateBankTransfer({
        userId: user.id,
        amount: amountNum,
        currency: "NGN",
        email: `${user.whatsappNumber.replace("+", "")}@nelo.app`,
        phoneNumber: user.whatsappNumber,
        fullName: `${user.firstName || "User"} ${user.lastName || ""}`.trim(),
      });

      if (result.success) {
        return `🏦 *Bank Transfer Initiated*

💰 Amount: ₦${amountNum.toLocaleString()}
🪙 You'll receive: ${amountNum.toLocaleString()} cNGN
🔗 Rate: 1 NGN = 1 cNGN (no fees!)

${result.paymentInstructions}

*After completing the transfer:*
Type "paid ${amount}" to confirm your payment

⚠️ Transfer the exact amount: ₦${amountNum.toLocaleString()}`;
      } else {
        return `❌ Failed to initiate bank transfer: ${result.error}

Try again with: "buy ${amount}"`;
      }
    } catch (error) {
      logger.error("Error handling buy with bank:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  private async handleConfirmPayment(user: any, data: any): Promise<string> {
    try {
      const amount = data?.amount;
      if (!amount) {
        return `❌ Please specify the amount you paid.
Example: "paid 10000"`;
      }

      // Use IntegratedOnRampService to confirm payment
      const { IntegratedOnRampService } = await import(
        "../payment/integratedOnRampService"
      );

      const result = await IntegratedOnRampService.confirmPayment({
        userId: user.id,
        amountNGN: parseFloat(amount),
        paymentReference: `nelo_deposit_${user.id}_${Date.now()}`,
      });

      if (result.success) {
        return `🎉 *Payment Confirmed!*

✅ Amount: ₦${parseFloat(amount).toLocaleString()} NGN
✅ cNGN Received: ${parseFloat(amount).toLocaleString()} cNGN
✅ Status: Completed

*Your wallet has been funded!*
• Check balance: "balance"
• Create card: "create card"
• Send money: "send 1000 to alice.base.eth"

Welcome to Nelo! 🚀`;
      } else {
        return `❌ Payment confirmation failed: ${result.error}

Please try again or contact support if you made the payment.`;
      }
    } catch (error) {
      logger.error("Error confirming payment:", error);
      return `❌ Payment confirmation failed. Please try again or contact support.`;
    }
  }

  private async handleResetPin(user: any): Promise<string> {
    try {
      const hasPinSetup = await PinService.hasPinSetup(user.id);
      if (!hasPinSetup) {
        return `❌ *No PIN Found*

You haven't set up a PIN yet.

Type "setup pin" to create your security PIN.`;
      }

      // Start PIN reset flow
      SessionManager.startFlow(user.whatsappNumber, "PIN_RESET");

      return `🔐 *PIN Reset - Security Verification*

To reset your PIN, I need to verify your identity first.

Please answer your security question:

*This will be shown in the next step...*`;
    } catch (error) {
      logger.error("Error handling PIN reset:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  private handleCancel(): string {
    return `❌ *Operation Cancelled*

Type "help" to see available commands.`;
  }
}
