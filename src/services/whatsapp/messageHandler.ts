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
1. Buy cNGN: "buy cngn" or "buy 10000"
2. Check balance: "balance"
3. Send money: "send 1000 to alice.base.eth"

Your card is ready! Fund it to start using. 🚀`;
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

*Available tokens:* cNGN and USDC on Base Sepolia`;
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

      return response;
    } catch (error) {
      logger.error("Error listing cards:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle transaction history intent - FIXED
   */
  private async handleTransactionHistory(user: any): Promise<string> {
    try {
      const transactions = await CardService.getRecentTransactions(user.id, 5);

      if (transactions.length === 0) {
        return `📊 *No transactions found*

Start by creating a card and making your first transaction!

• Create card: "create card"
• Buy crypto: "buy cngn"
• Send money: "send 1000 to alice.base.eth"`;
      }

      let response = `📊 *Recent Transactions*

`;

      transactions.forEach((tx, index) => {
        const date = new Date(tx.createdAt).toLocaleDateString();
        response += `${index + 1}. ${tx.type} - ${tx.amount} ${tx.currency}
   ${tx.status} • ${date}`;
        if (tx.description) {
          response += `
   ${tx.description}`;
        }
        response += `

`;
      });

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
   * Handle other methods with simple responses for now
   */
  private async handleSendMoney(user: any, data: any): Promise<string> {
    return `💸 *Send Money*

Feature coming soon! For now, you can:
• Check balance: "balance"
• Buy crypto: "buy cngn"
• View history: "history"`;
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
💳 Wallet: \`${user.walletAddress?.slice(0, 6)}...${user.walletAddress?.slice(
        -4
      )}\`
🎴 Cards: ${cardCount}
🆔 KYC Status: ${kycStatus.verified ? "✅ Verified" : "❌ Not Verified"}
🔐 PIN Status: ${hasPinSetup ? "✅ Set Up" : "❌ Not Set Up"}
📅 Joined: ${new Date(user.createdAt).toLocaleDateString()}

Type "help" to see what you can do!`;
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

      return `💵 *Buy ${amountNum} USDC*

💰 Cost: $${amountNum} USD
🪙 You'll receive: ${amountNum} USDC
⚡ Network: Base Sepolia
🔗 Rate: 1 USD = 1 USDC

*Payment Methods:*
1️⃣ Credit/Debit Card (via MoonPay)
2️⃣ Bank Transfer (International)
3️⃣ Crypto Swap (if you have other tokens)

Reply with your choice (1, 2, or 3):

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
    return `🏷️ *Basename Coming Soon*

Base name support is being added! For now:
• Create card: "create card"
• Buy crypto: "buy cngn"`;
  }

  private async handleCheckBasename(data: any): Promise<string> {
    return `🔍 *Basename Check Coming Soon*

This feature is being added! For now:
• Create card: "create card"
• Buy crypto: "buy cngn"`;
  }

  private async handleWithdraw(user: any, data: any): Promise<string> {
    return `💸 *Withdraw Coming Soon*

Cash out feature is being added! For now:
• Check balance: "balance"
• Buy crypto: "buy cngn"`;
  }

  private async handleBankAccount(user: any): Promise<string> {
    return `🏦 *Bank Account Coming Soon*

Bank linking is being added! For now:
• Buy crypto: "buy cngn"
• Check balance: "balance"`;
  }

  private async handleAddBank(user: any, data: any): Promise<string> {
    return `🏦 *Add Bank Coming Soon*

Bank account linking is being added! For now:
• Buy crypto: "buy cngn"
• Check balance: "balance"`;
  }

  private async handleCashOut(user: any, data: any): Promise<string> {
    return `💸 *Cash Out Coming Soon*

Withdrawal to bank is being added! For now:
• Check balance: "balance"
• Buy crypto: "buy cngn"`;
  }

  private async handleBuyWithBank(user: any, data: any): Promise<string> {
    return `🏦 *Bank Purchase Coming Soon*

Direct bank purchases are being added! For now:
• Buy crypto: "buy cngn"
• Check balance: "balance"`;
  }

  private async handleConfirmPayment(user: any, data: any): Promise<string> {
    return `✅ *Payment Confirmation Coming Soon*

Payment confirmation is being added! For now:
• Buy crypto: "buy cngn"
• Check balance: "balance"`;
  }

  private async handleResetPin(user: any): Promise<string> {
    return `🔐 *PIN Reset Coming Soon*

PIN reset feature is being added! For now:
• Setup PIN: "setup pin"
• Get help: "help"`;
  }

  private handleCancel(): string {
    return `❌ *Operation Cancelled*

Type "help" to see available commands.`;
  }
}
