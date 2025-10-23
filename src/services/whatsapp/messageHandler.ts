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
   * Enhanced create card with PIN and KYC checks
   */
  private async handleCreateCard(user: any): Promise<string> {
    try {
      // Check KYC status first
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
💰 Balance: 0 cNGN
📱 Status: Active

*Next Steps:*
1. Fund your card: "deposit to card"
2. Check balance: "balance"
3. View card details: "my cards"

Your card is ready to use! 🚀`;
      } else {
        if (
          result.error?.includes("KYC") ||
          result.error?.includes("verification")
        ) {
          return `🔒 *Verification Required*

${result.error}

Type "verify id" to complete your verification and create your card.`;
        }
        return `❌ Failed to create card: ${result.error}`;
      }
    } catch (error) {
      logger.error("Error creating card:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle check balance intent - Multi-token support
   */
  private async handleCheckBalance(user: any): Promise<string> {
    try {
      // Get balances for all supported tokens
      const balances = {
        cngn: 0,
        usdc: 0,
        usdt: 0,
        cardCount: 0,
      };

      // Get cNGN balance
      try {
        const { CngnService } = await import("../blockchain/cngnService");
        const cngnBalance = await CngnService.getBalance(user.walletAddress);
        balances.cngn = parseFloat(cngnBalance.balance);
      } catch (error) {
        logger.warn("Failed to get cNGN balance:", error);
      }

      // Get card count
      balances.cardCount = await CardService.getCardCount(user.id);

      // TODO: Add USDC and USDT balance fetching when contracts are deployed
      // For now, mock some balances for demo
      if (user.metadata?.mockBalances) {
        balances.usdc = user.metadata.mockBalances.usdc || 0;
        balances.usdt = user.metadata.mockBalances.usdt || 0;
      }

      return MESSAGE_TEMPLATES.BALANCE_INFO(balances);
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
   * Enhanced send money with PIN verification
   */
  private async handleSendMoney(user: any, data: any): Promise<string> {
    try {
      const { amount, recipient } = data;

      // Check PIN setup
      const hasPinSetup = await PinService.hasPinSetup(user.id);
      if (!hasPinSetup) {
        return `🔐 *Transaction PIN Required*

For security, you need to set up a PIN before sending money.

Type "setup pin" to secure your account.`;
      }

      // Validate amount and recipient first
      if (!amount || !recipient) {
        return `❌ *Invalid Transaction*

Please specify both amount and recipient.

*Example:*
"send 1000 to alice.base.eth"
"send 500 to 0x1234..."`;
      }

      // Validate basename before transfer (Edge Case #1)
      let recipientAddress = recipient;
      if (recipient.includes(".base") || recipient.includes(".eth")) {
        const resolved = await BasenameService.resolveBasename(recipient);
        if (!resolved.isValid) {
          return `❌ Basename "${recipient}" is not registered or invalid.`;
        }
        recipientAddress = resolved.address;
      }

      // Prevent self-transfers (Edge Case #6)
      if (recipientAddress.toLowerCase() === user.walletAddress.toLowerCase()) {
        return "❌ You cannot send money to yourself.";
      }

      // Determine token type from amount (default to cNGN)
      let token = "cngn";
      let cleanAmount = amount;

      // Check if amount includes token symbol
      if (amount.toLowerCase().includes("usdc")) {
        token = "usdc";
        cleanAmount = amount.replace(/usdc/i, "").trim();
      } else if (amount.toLowerCase().includes("usdt")) {
        token = "usdt";
        cleanAmount = amount.replace(/usdt/i, "").trim();
      } else if (amount.toLowerCase().includes("cngn")) {
        token = "cngn";
        cleanAmount = amount.replace(/cngn/i, "").trim();
      }

      // Check balance before transfer
      try {
        if (token === "cngn") {
          const { CngnService } = await import("../blockchain/cngnService");
          const balance = await CngnService.getBalance(user.walletAddress);
          const balanceNum = parseFloat(balance.balance);
          const amountNum = parseFloat(cleanAmount);

          if (balanceNum < amountNum) {
            return `❌ Insufficient cNGN balance. You have ${balance.balance} cNGN, need ${cleanAmount} cNGN.

Buy more: "buy cngn"`;
          }
        } else {
          // For USDC/USDT, check mock balances for now
          const mockBalances = user.metadata?.mockBalances || {};
          const tokenBalance = mockBalances[token] || 0;
          const amountNum = parseFloat(cleanAmount);

          if (tokenBalance < amountNum) {
            return `❌ Insufficient ${token.toUpperCase()} balance. You have ${tokenBalance} ${token.toUpperCase()}, need ${cleanAmount} ${token.toUpperCase()}.

Buy more: "buy ${token}"`;
          }
        }
      } catch (error) {
        logger.error("Error checking balance:", error);
        return "❌ Unable to check balance. Please try again.";
      }

      // Check if user is confirming a previous transaction
      const session = SessionManager.getSession(user.whatsappNumber);
      if (session?.flowData?.awaitingTransactionConfirmation) {
        const confirmationData = session.flowData;

        if (data.toLowerCase() === "yes" || data === "1") {
          // Proceed with transfer
          try {
            let transferResult;
            const token = confirmationData.token || "cngn";

            if (token === "cngn") {
              const { CngnService } = await import("../blockchain/cngnService");
              transferResult = await CngnService.transfer(
                user.encryptedPrivateKey!,
                confirmationData.recipientAddress,
                confirmationData.amount
              );
            } else {
              // For USDC/USDT, mock the transfer for now
              transferResult = {
                success: true,
                txHash: `0x${Math.random().toString(16).substring(2, 66)}`,
              };

              // Update mock balances
              const mockBalances = user.metadata?.mockBalances || {};
              mockBalances[token] =
                (mockBalances[token] || 0) -
                parseFloat(confirmationData.amount);

              await UserService.updateUserMetadata(user.id, {
                ...user.metadata,
                mockBalances,
              });
            }

            SessionManager.completeFlow(user.whatsappNumber);

            if (transferResult.success) {
              return MESSAGE_TEMPLATES.TRANSACTION_SUCCESS(
                confirmationData.amount,
                token,
                confirmationData.recipient,
                transferResult.txHash!
              );
            } else {
              return `❌ Transfer failed: ${transferResult.error}`;
            }
          } catch (transferError) {
            logger.error("Transfer execution failed:", transferError);
            SessionManager.completeFlow(user.whatsappNumber);
            return "❌ Transfer failed. Please try again.";
          }
        } else if (data.toLowerCase() === "no" || data === "2") {
          SessionManager.completeFlow(user.whatsappNumber);
          return "❌ Transfer cancelled.";
        } else {
          return "❌ Please reply with:\n1️⃣ Yes, send\n2️⃣ No, cancel";
        }
      }

      // Ask for confirmation before proceeding
      SessionManager.updateSession(user.whatsappNumber, {
        flowData: {
          awaitingTransactionConfirmation: true,
          recipient,
          recipientAddress,
          amount: cleanAmount,
          token,
        },
      });

      return `⚠️ *Confirm Transfer*

To: ${recipient}
Address: ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}
Amount: ${cleanAmount} ${token.toUpperCase()}

Reply:
1️⃣ Yes, send
2️⃣ No, cancel`;
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
      const kycStatus = await UserService.getKYCStatus(user.id);
      const hasPinSetup = await PinService.hasPinSetup(user.id);

      let response = `👤 *Your Profile*\n\n`;
      response += `📱 WhatsApp: ${user.whatsappNumber}\n`;
      response += `💳 Wallet: \`${user.walletAddress}\`\n`;

      if (user.basename) {
        response += `🏷️ Basename: ${user.basename}\n`;
      }

      response += `💰 Total Balance: ${totalBalance} cNGN\n`;
      response += `🎴 Cards: ${cardCount}\n`;
      response += `🆔 KYC Status: ${
        kycStatus.verified ? "✅ Verified" : "❌ Not Verified"
      }\n`;
      response += `🔐 PIN Status: ${
        hasPinSetup ? "✅ Set Up" : "❌ Not Set Up"
      }\n`;
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
        return `🔍 *Basename Check Results*

🏷️ Name: ${formattedBasename}
📍 Status: ❌ Not registered

Register at: https://www.base.org/names`;
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
      const amountNum = parseFloat(amount);

      // Validate amount
      if (amountNum < 100) {
        return "❌ Minimum deposit is ₦100";
      }

      if (amountNum > 1000000) {
        return "❌ Maximum deposit is ₦1,000,000";
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

${result.paymentInstructions}

*After transfer:*
Reply "paid ${amount}" to confirm

*You'll receive:*
${amountNum.toLocaleString()} cNGN in your wallet

*Rate:* 1 NGN = 1 cNGN
*No fees!* 🎉

⚠️ Only transfer the exact amount to avoid delays.`;
      } else {
        return `❌ Failed to initiate purchase: ${result.error}`;
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
      const fees = IntegratedOffRampService.calculateWithdrawalFee(
        parseFloat(amount)
      );

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
      const banks = await IntegratedOffRampService.getSupportedBanks();
      const bankList = banks
        .slice(0, 10)
        .map((bank: any, index: number) => `${index + 1}. ${bank.name}`)
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
   * Handle Buy USDC
   */
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
⚡ Network: Base
🔗 Rate: 1 USD = 1 USDC

*Payment Methods:*
1️⃣ Credit/Debit Card
2️⃣ Bank Transfer
3️⃣ Apple Pay / Google Pay

Reply with your choice (1, 2, or 3):

*What is USDC?*
USD Coin - A stable cryptocurrency backed 1:1 by US Dollars. Perfect for international transactions and DeFi.`;
    } catch (error) {
      logger.error("Error handling buy USDC:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle Buy USDT
   */
  private async handleBuyUSDT(user: any, data: any): Promise<string> {
    try {
      const amount = data?.amount || "100"; // Default $100
      const amountNum = parseFloat(amount);

      // Validate amount
      if (amountNum < 10) {
        return "❌ Minimum purchase is $10 USDT";
      }

      if (amountNum > 10000) {
        return "❌ Maximum purchase is $10,000 USDT";
      }

      return `💰 *Buy ${amountNum} USDT*

💰 Cost: $${amountNum} USD
🪙 You'll receive: ${amountNum} USDT
⚡ Network: Base
🔗 Rate: 1 USD = 1 USDT

*Payment Methods:*
1️⃣ Credit/Debit Card
2️⃣ Bank Transfer
3️⃣ Apple Pay / Google Pay

Reply with your choice (1, 2, or 3):

*What is USDT?*
Tether - The world's most popular stablecoin, backed by US Dollars. Widely accepted and highly liquid.`;
    } catch (error) {
      logger.error("Error handling buy USDT:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle Buy Crypto - Show options
   */
  private async handleBuyCrypto(user: any): Promise<string> {
    try {
      return `💰 *Buy Crypto*

Choose your cryptocurrency:

🇳🇬 *cNGN (Nigerian Naira)*
• Pay with: Bank transfer, Card
• Best for: Nigerian users
• Command: "buy cngn"

💵 *USDC (USD Coin)*  
• Pay with: Card, Bank transfer
• Best for: International users
• Command: "buy usdc"

💰 *USDT (Tether)*
• Pay with: Card, Bank transfer  
• Best for: Trading, DeFi
• Command: "buy usdt"

*Quick Start:*
• "buy cngn" - For Nigerians
• "buy usdc" - For USD users
• "buy usdt" - For traders

*New to crypto?* Start with cNGN if you're in Nigeria, or USDC for international use.`;
    } catch (error) {
      logger.error("Error handling buy crypto:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle add bank account
   */
  private async handleAddBank(user: any, data: any): Promise<string> {
    try {
      if (!data?.accountNumber || !data?.bankName || !data?.accountName) {
        const banks = await flutterwaveService.getSupportedBanks();
        const bankList = banks
          .slice(0, 8)
          .map((bank: any, index: number) => `${index + 1}. ${bank.name}`)
          .join("\n");

        return `🏦 *Add Bank Account*

Please provide your bank details:

*Format:*
"My bank is GTB, account 0123456789, John Doe"

*Supported Banks:*
${bankList}
...and more

*Example:*
"My bank is Access Bank, account 0987654321, Jane Smith"

🔒 Your details are encrypted and secure.`;
      }

      // Find bank code (mock for demo)
      const banks = await flutterwaveService.getSupportedBanks();
      const bank = banks.find(
        (b) =>
          b.name.toLowerCase().includes(data.bankName.toLowerCase()) ||
          data.bankName.toLowerCase().includes(b.name.toLowerCase())
      );

      const bankCode = bank?.code || "000";

      const result = await UserService.addBankAccount(
        user.id,
        data.accountNumber,
        data.bankName,
        bankCode,
        data.accountName
      );

      if (result.success) {
        return `✅ *Bank Account Added Successfully!*

🏦 Bank: ${data.bankName}
💳 Account: ${data.accountNumber}
👤 Name: ${data.accountName}

*You can now:*
• Withdraw cNGN: "cash out 50000"
• View accounts: "my banks"
• Buy cNGN with bank transfer

Your account is ready for withdrawals! 💸`;
      } else {
        return `❌ Failed to add bank account: ${result.error}

Please check your details and try again.`;
      }
    } catch (error) {
      logger.error("Error adding bank account:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle cash out (cNGN to fiat)
   */
  private async handleCashOut(user: any, data: any): Promise<string> {
    try {
      if (!data?.amount) {
        const balance = await CardService.getTotalBalance(user.id);
        const bankAccounts = await UserService.getBankAccounts(user.id);

        if (bankAccounts.length === 0) {
          return `💸 *Cash Out cNGN*

Current Balance: ${balance} cNGN

❌ No bank account found. Add one first:
"add bank GTB 0123456789 John Doe"

Then try: "cash out 50000"`;
        }

        return `💸 *Cash Out cNGN*

Current Balance: ${balance} cNGN
Available Banks: ${bankAccounts.length}

*To withdraw:*
"cash out 50000" (amount in cNGN)

*Fees:* 1.5% processing fee
*Time:* 1-3 business days

Minimum: 1,000 cNGN
Maximum: 500,000 cNGN per day`;
      }

      const amount = parseFloat(data.amount);

      if (amount < 1000) {
        return `❌ Minimum withdrawal is 1,000 cNGN`;
      }

      // Check PIN setup
      const hasPinSetup = await PinService.hasPinSetup(user.id);
      if (!hasPinSetup) {
        return `🔐 *Transaction PIN Required*

For security, you need to set up a PIN before withdrawing money.

Type "setup pin" to secure your account.`;
      }

      // Check KYC limits
      const kycPermission = await KYCService.canPerformAction(
        user.id,
        "WITHDRAW",
        amount
      );

      if (!kycPermission.allowed) {
        return `🔒 *Withdrawal Limit Exceeded*

${kycPermission.reason}

${
  kycPermission.requiredLevel
    ? `Upgrade to ${kycPermission.requiredLevel} level for higher limits.`
    : ""
}

Type "verify id" to upgrade your account.`;
      }

      const bankAccounts = await UserService.getBankAccounts(user.id);

      if (bankAccounts.length === 0) {
        return `❌ No bank account found. Add one first:
"add bank GTB 0123456789 John Doe"`;
      }

      // Use IntegratedOffRampService for complete withdrawal flow
      const { IntegratedOffRampService } = await import(
        "../payment/integratedOffRampService"
      );

      const feeCalculation =
        IntegratedOffRampService.calculateWithdrawalFee(amount);

      // Ask for confirmation
      const session = SessionManager.getSession(user.whatsappNumber);
      if (session?.flowData?.awaitingWithdrawalConfirmation) {
        const confirmationData = session.flowData;

        if (data.toLowerCase() === "yes" || data === "1") {
          // Proceed with withdrawal
          const result = await IntegratedOffRampService.withdrawCNGN({
            userId: user.id,
            amountCNGN: confirmationData.amount,
            bankAccountId: confirmationData.bankAccountId,
          });

          SessionManager.completeFlow(user.whatsappNumber);

          if (result.success) {
            return `✅ *Withdrawal Initiated!*\n\nAmount: ${confirmationData.amount.toLocaleString()} cNGN\nFee: ${feeCalculation.fee.toLocaleString()} NGN\nYou'll receive: ₦${result.netAmount?.toLocaleString()}\n\nReference: ${
              result.withdrawalReference
            }\nEstimated time: ${result.estimatedTime}`;
          } else {
            return `❌ Withdrawal failed: ${result.error}`;
          }
        } else if (data.toLowerCase() === "no" || data === "2") {
          SessionManager.completeFlow(user.whatsappNumber);
          return "❌ Withdrawal cancelled.";
        } else {
          return "❌ Please reply with:\n1️⃣ Yes, withdraw\n2️⃣ No, cancel";
        }
      }

      // Ask for confirmation
      SessionManager.updateSession(user.whatsappNumber, {
        flowData: {
          awaitingWithdrawalConfirmation: true,
          amount,
          bankAccountId: bankAccounts[0].id,
        },
      });

      return `⚠️ *Confirm Withdrawal*\n\nAmount: ${amount.toLocaleString()} cNGN\nFee: ${feeCalculation.fee.toLocaleString()} NGN (${
        feeCalculation.feePercentage * 100
      }%)\nYou'll receive: ₦${feeCalculation.netAmount.toLocaleString()}\nBank: ${
        bankAccounts[0].bankName
      }\nAccount: ${
        bankAccounts[0].accountNumber
      }\n\nReply:\n1️⃣ Yes, withdraw\n2️⃣ No, cancel`;
    } catch (error) {
      logger.error("Error handling cash out:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle buy cNGN with bank transfer
   */
  private async handleBuyWithBank(user: any, data: any): Promise<string> {
    try {
      if (!data?.amount) {
        return `💰 *Buy cNGN with Bank Transfer*

Your Virtual Account:
🏦 Bank: ${user.virtualBankName || "Wema Bank"}
💳 Account: ${user.virtualAccountNumber || "Not set up"}
👤 Name: Your Nelo Account

*To buy cNGN:*
"buy 10000" (amount in NGN)

*How it works:*
1. Transfer NGN to your virtual account
2. Confirm payment: "paid 10000"
3. Receive cNGN in your wallet

*Rate:* 1 NGN = 1 cNGN
*Fee:* No fees for deposits! 🎉`;
      }

      const amount = parseFloat(data.amount);

      if (amount < 100) {
        return `❌ Minimum purchase is ₦100`;
      }

      const result = await MockFiatService.initiateFiatToCNGN({
        userId: user.id,
        amount: amount,
        paymentMethod: "BANK_TRANSFER",
        virtualAccountNumber: user.virtualAccountNumber,
      });

      if (result.success) {
        return `💰 *Buy ${amount.toLocaleString()} cNGN*

${result.paymentInstructions}

*After transfer:*
Reply "paid ${amount}" to confirm

*You'll receive:*
${amount.toLocaleString()} cNGN in your wallet

*Rate:* 1 NGN = 1 cNGN
*No fees!* 🎉

⚠️ Only transfer the exact amount to avoid delays.`;
      } else {
        return `❌ Failed to initiate purchase: ${result.error}`;
      }
    } catch (error) {
      logger.error("Error handling buy with bank:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle payment confirmation
   */
  private async handleConfirmPayment(user: any, data: any): Promise<string> {
    try {
      if (!data?.amount) {
        return `❌ Please specify the amount you paid.
Example: "paid 10000"`;
      }

      const amount = parseFloat(data.amount);

      // Find recent pending transaction
      const recentTransactions = await CardService.getRecentTransactions(
        user.id,
        5
      );
      const pendingTransaction = recentTransactions.find(
        (tx) =>
          tx.type === "ONRAMP" &&
          tx.status === "PENDING" &&
          Math.abs(parseFloat(tx.amount.toString()) - amount) < 1
      );

      if (!pendingTransaction) {
        return `❌ No matching payment found for ₦${amount.toLocaleString()}.

Make sure you:
1. Transferred the exact amount
2. Used the correct account details
3. Initiated the purchase first

Try "buy ${amount}" to start a new purchase.`;
      }

      const metadata = pendingTransaction.metadata as any;
      const paymentReference = metadata?.paymentReference;

      if (!paymentReference) {
        return `❌ Invalid payment reference. Please try again.`;
      }

      // Use IntegratedOnRampService to confirm and mint cNGN
      const { IntegratedOnRampService } = await import(
        "../payment/integratedOnRampService"
      );

      const result = await IntegratedOnRampService.confirmPaymentAndMintCNGN(
        paymentReference
      );

      if (result.success) {
        return `🎉 *Payment Confirmed!*

✅ Received: ₦${amount.toLocaleString()}
💰 cNGN Credited: ${result.cngnAmount?.toLocaleString()} cNGN
🔗 Transaction: ${result.txHash?.slice(0, 10)}...

*Your cNGN is ready!*
• Check balance: "balance"
• Create card: "create card"
• Send money: "send 1000 to alice.base.eth"

Welcome to the future of money! 🚀`;
      } else {
        return `❌ Payment confirmation failed: ${result.error}

Please try again or contact support.`;
      }
    } catch (error) {
      logger.error("Error confirming payment:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle PIN setup
   */
  private async handleSetupPin(user: any): Promise<string> {
    try {
      // Check if PIN is already set up
      const hasPinSetup = await PinService.hasPinSetup(user.id);
      if (hasPinSetup) {
        return `🔐 *PIN Already Set Up*

Your transaction PIN is already configured.

*Options:*
• Reset PIN: "reset pin"
• Change PIN: "reset pin"
• Continue using Nelo: "help"

Your account is secure! 🔒`;
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
   * Handle PIN reset
   */
  private async handleResetPin(user: any): Promise<string> {
    try {
      // Check if PIN exists
      const hasPinSetup = await PinService.hasPinSetup(user.id);
      if (!hasPinSetup) {
        return `❌ *No PIN Found*

You haven't set up a PIN yet.

Type "setup pin" to create your transaction PIN.`;
      }

      // Start PIN reset flow
      SessionManager.startFlow(user.whatsappNumber, "PIN_RESET");

      // Get user's security question
      const userRecord = await UserService.findByWhatsAppNumber(
        user.whatsappNumber
      );
      const security = (userRecord?.metadata as any)?.security;

      if (!security || !security.securityQuestionId) {
        SessionManager.completeFlow(user.whatsappNumber);
        return `❌ *Security Question Not Found*

Your account doesn't have a security question set up.
Please contact support for PIN reset assistance.`;
      }

      const questions = PinService.getSecurityQuestions();
      const userQuestion = questions.find(
        (q) => q.id === security.securityQuestionId
      );

      if (!userQuestion) {
        SessionManager.completeFlow(user.whatsappNumber);
        return `❌ *Security Question Error*

There's an issue with your security question.
Please contact support for assistance.`;
      }

      return `🔒 *PIN Reset - Security Verification*

To reset your PIN, please answer your security question:

"${userQuestion.question}"

Your answer:`;
    } catch (error) {
      logger.error("Error handling PIN reset:", error);
      return MESSAGE_TEMPLATES.ERROR_GENERIC;
    }
  }

  /**
   * Handle cancel command
   */
  private handleCancel(): string {
    return `❌ *Operation Cancelled*

You can start over anytime:
• Set up PIN: "setup pin"
• Verify identity: "verify id"
• Get help: "help"

What would you like to do next?`;
  }
}
