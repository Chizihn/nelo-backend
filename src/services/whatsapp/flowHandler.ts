import { UserSession, SessionManager } from "./sessionManager";
import { PinService } from "../security/pinService";
import { KYCService } from "../kyc/kycService";
import { UserService } from "../user/userService";
import { CardService } from "../card/cardService";
import { MockFiatService } from "../payment/mockFiatService";
import { logger } from "@/utils/logger";

export class FlowHandler {
  /**
   * Handle PIN setup flow
   */
  static async handlePinSetupFlow(
    whatsappNumber: string,
    message: string,
    session: UserSession
  ): Promise<string> {
    const step = session.flowStep || 1;
    const flowData = session.flowData || {};

    switch (step) {
      case 1:
        // Welcome to PIN setup
        SessionManager.advanceFlow(whatsappNumber);
        return `🔐 *Set Up Your Transaction PIN*

  Your PIN secures all transactions and sensitive operations.

  *PIN Requirements:*
  • Exactly 4 digits
  • No repeated numbers (1111, 2222, etc.)
  • No sequential numbers (1234, 4321, etc.)

  Please enter your 4-digit PIN:`;

      case 2:
        // Validate and store PIN (hide PIN in response)
        const pinValidation = PinService.validatePinFormat(message);
        if (!pinValidation.valid) {
          return `❌ ${pinValidation.errors.join(
            "\n"
          )}\n\nPlease enter a valid 4-digit PIN:`;
        }

        // Check if PIN already exists in flow data to prevent duplicate processing
        if (flowData.pin && flowData.pin === message) {
          // Already processed this PIN, advance to confirmation
          return `✅ PIN received (••••)

  Please confirm your PIN by entering it again:`;
        }

        SessionManager.advanceFlow(whatsappNumber, { pin: message });
        return `✅ PIN received (••••)

  Please confirm your PIN by entering it again:`;

      case 3:
        // Confirm PIN (hide PIN in response)
        if (message !== flowData.pin) {
          SessionManager.updateSession(whatsappNumber, { flowStep: 2 });
          return `❌ PINs don't match!

  Please enter your 4-digit PIN again:`;
        }

        SessionManager.advanceFlow(whatsappNumber, { confirmPin: message });

        // Show security questions
        const questions = PinService.getSecurityQuestions();
        let questionsList = `🔒 *Choose Security Question*

  This helps recover your PIN if forgotten:

  `;

        questions.forEach((q, index) => {
          questionsList += `${index + 1}. ${q.question}\n`;
        });

        questionsList += `\nReply with number (1-${questions.length}):`;

        return questionsList;

      case 4:
        // Select security question
        const questionIndex = parseInt(message) - 1;
        const questions4 = PinService.getSecurityQuestions();

        if (
          isNaN(questionIndex) ||
          questionIndex < 0 ||
          questionIndex >= questions4.length
        ) {
          return `❌ Invalid selection!\n\nPlease choose a number between 1 and ${questions4.length}:`;
        }

        const selectedQuestion = questions4[questionIndex];
        SessionManager.advanceFlow(whatsappNumber, {
          securityQuestionId: selectedQuestion.id,
          securityQuestion: selectedQuestion.question,
        });

        return `🔒 *Security Question Selected:*\n"${selectedQuestion.question}"\n\nPlease provide your answer:`;

      case 5:
        // Security answer
        if (!message || message.trim().length < 2) {
          return `❌ Answer too short!\n\nPlease provide an answer with at least 2 characters:`;
        }

        SessionManager.advanceFlow(whatsappNumber, {
          securityAnswer: message.trim(),
        });

        // Setup PIN
        const setupResult = await PinService.setupPin(session.userId, {
          pin: flowData.pin,
          confirmPin: flowData.confirmPin,
          securityQuestionId: flowData.securityQuestionId,
          securityAnswer: message.trim(),
        });

        SessionManager.completeFlow(whatsappNumber);

        if (setupResult.success) {
          // Import MESSAGE_TEMPLATES
          const { MESSAGE_TEMPLATES } = await import("@/config/whatsapp");
          return MESSAGE_TEMPLATES.PIN_SETUP_COMPLETE;
        } else {
          return `❌ PIN setup failed: ${setupResult.error}

  Please try again: "setup pin"`;
        }

      default:
        SessionManager.completeFlow(whatsappNumber);
        return `❌ Something went wrong. Please start over by typing "setup pin"`;
    }
  }

  /**
   * Handle KYC verification flow - SIMPLIFIED
   */
  static async handleKYCFlow(
    whatsappNumber: string,
    message: string,
    session: UserSession
  ): Promise<string> {
    const step = session.flowStep || 1;
    const flowData = session.flowData || {};

    switch (step) {
      case 1:
        // Welcome to KYC - ask for full name in one step
        SessionManager.advanceFlow(whatsappNumber);
        return `🆔 *Submit KYC - Identity Verification*

  To comply with regulations and secure your account, I need to verify your identity.

  *Benefits after verification:*
  ✅ Create virtual cards
  ✅ Higher transaction limits  
  ✅ Buy/sell crypto
  ✅ Send money globally

  Please enter your *full name* (First Last):
  Example: "John Doe"`;

      case 2:
        // Full name validation
        const fullName = message.trim();
        if (!fullName || fullName.length < 3 || !fullName.includes(" ")) {
          return `❌ Please enter your full name with first and last name:
  Example: "John Doe" or "Mary Jane Smith"`;
        }

        const nameParts = fullName.split(" ");
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(" ");

        SessionManager.advanceFlow(whatsappNumber, {
          firstName,
          lastName,
          fullName,
        });

        return `✅ Name: ${fullName}

  Optional: Enter your *ID number* or type "skip":
  (BVN, NIN, Driver's License, etc.)`;

      case 3:
        // ID number (optional) and complete KYC
        const idNumber =
          message.toLowerCase() === "skip" ? undefined : message.trim();

        // Complete KYC verification
        const kycResult = await UserService.verifyKYC(session.userId, {
          firstName: flowData.firstName,
          lastName: flowData.lastName,
          idNumber,
        });

        SessionManager.completeFlow(whatsappNumber);

        if (kycResult.success) {
          // Import MESSAGE_TEMPLATES
          const { MESSAGE_TEMPLATES } = await import("@/config/whatsapp");
          return MESSAGE_TEMPLATES.KYC_COMPLETE(
            flowData.firstName,
            flowData.lastName
          );
        } else {
          return `❌ KYC submission failed: ${kycResult.error}

  Please try again: "submit kyc"`;
        }

      default:
        SessionManager.completeFlow(whatsappNumber);
        return `❌ Something went wrong. Please start over: "submit kyc"`;
    }
  }

  /**
   * Handle PIN verification for transactions
   */
  static async handlePinVerification(
    whatsappNumber: string,
    pin: string,
    session: UserSession
  ): Promise<{
    success: boolean;
    message: string;
    shouldProceed?: boolean;
  }> {
    const pinResult = await PinService.verifyUserPin(session.userId, pin);

    SessionManager.clearAwaitingPin(whatsappNumber);

    if (pinResult.success) {
      return {
        success: true,
        message: "✅ PIN verified successfully!",
        shouldProceed: true,
      };
    } else if (pinResult.locked) {
      return {
        success: false,
        message: `🔒 ${pinResult.error}\n\nYou can reset your PIN by typing "reset pin"`,
      };
    } else {
      return {
        success: false,
        message: `❌ ${pinResult.error}`,
      };
    }
  }

  /**
   * Handle PIN reset flow
   */
  static async handlePinResetFlow(
    whatsappNumber: string,
    message: string,
    session: UserSession
  ): Promise<string> {
    const step = session.flowStep || 1;
    const flowData = session.flowData || {};

    switch (step) {
      case 1:
        // Get user's security question
        const user = await UserService.findByWhatsAppNumber(whatsappNumber);
        if (!user) {
          SessionManager.completeFlow(whatsappNumber);
          return `❌ User not found. Please contact support.`;
        }

        const security = (user.metadata as any)?.security;
        if (!security || !security.securityQuestionId) {
          SessionManager.completeFlow(whatsappNumber);
          return `❌ Security question not set up. Please contact support.`;
        }

        const questions = PinService.getSecurityQuestions();
        const userQuestion = questions.find(
          (q) => q.id === security.securityQuestionId
        );

        if (!userQuestion) {
          SessionManager.completeFlow(whatsappNumber);
          return `❌ Security question not found. Please contact support.`;
        }

        SessionManager.advanceFlow(whatsappNumber, {
          securityQuestion: userQuestion,
        });
        return `🔒 *PIN Reset - Security Verification*\n\nPlease answer your security question:\n\n"${userQuestion.question}"\n\nYour answer:`;

      case 2:
        // Verify security answer and get new PIN
        SessionManager.advanceFlow(whatsappNumber, {
          securityAnswer: message.trim(),
        });
        return `✅ Security answer received.\n\nNow enter your new 4-digit PIN:`;

      case 3:
        // Validate new PIN
        const pinValidation = PinService.validatePinFormat(message);
        if (!pinValidation.valid) {
          return `❌ ${pinValidation.errors.join(
            "\n"
          )}\n\nPlease enter a valid 4-digit PIN:`;
        }

        SessionManager.advanceFlow(whatsappNumber, { newPin: message });
        return `✅ New PIN accepted!\n\nPlease confirm your new PIN:`;

      case 4:
        // Confirm new PIN and reset
        if (message !== flowData.newPin) {
          SessionManager.updateSession(whatsappNumber, { flowStep: 3 });
          return `❌ PINs don't match!\n\nPlease enter your new PIN again:`;
        }

        const resetResult = await PinService.resetPin(
          session.userId,
          flowData.securityAnswer,
          flowData.newPin,
          message
        );

        SessionManager.completeFlow(whatsappNumber);

        if (resetResult.success) {
          return `🎉 *PIN Reset Successful!*\n\n✅ Your new PIN is now active\n✅ All previous attempts cleared\n\nYour account is secure again! 🔐`;
        } else {
          return `❌ PIN reset failed: ${resetResult.error}\n\nPlease try again or contact support.`;
        }

      default:
        SessionManager.completeFlow(whatsappNumber);
        return `❌ Something went wrong. Please start over by typing "reset pin"`;
    }
  }

  /**
   * Handle transaction with PIN verification
   */
  static async handleSecureTransaction(
    whatsappNumber: string,
    transactionType: string,
    transactionData: any,
    session: UserSession
  ): Promise<string> {
    // Check if user has PIN setup
    const hasPinSetup = await PinService.hasPinSetup(session.userId);
    if (!hasPinSetup) {
      return `🔐 *PIN Required*\n\nYou need to set up a transaction PIN first for security.\n\nType "setup pin" to get started.`;
    }

    // For SEND_MONEY, show cost breakdown including gas fees
    if (transactionType === "SEND_MONEY") {
      try {
        const { FeeService } = await import("../payment/feeService");
        const { UserService } = await import("../user/userService");
        const { BasenameService } = await import(
          "../blockchain/basenameService"
        );

        // Resolve recipient address if it's a basename
        let recipientAddress = transactionData.recipient;
        if (transactionData.recipient.endsWith(".base.eth")) {
          const resolved = await BasenameService.resolveBasename(
            transactionData.recipient
          );
          if (!resolved.isValid) {
            return `❌ Could not resolve ${transactionData.recipient}. Please check the basename.`;
          }
          recipientAddress = resolved.address;
        }

        // Calculate total cost including gas fees
        const costBreakdown = await FeeService.calculateTotalTransactionCost(
          transactionData.amount,
          "TRANSFER"
        );

        // Check user balance
        const user = await UserService.getUserById(session.userId);
        if (user?.walletAddress) {
          const { CngnService } = await import("../blockchain/cngnService");
          const balance = await CngnService.getBalance(user.walletAddress);

          if (parseFloat(balance.balance) < costBreakdown.totalCostNGN) {
            return `❌ Insufficient balance\n\n${
              costBreakdown.breakdown
            }\n\nYou have: ${parseFloat(
              balance.balance
            ).toLocaleString()} cNGN\nYou need: ${costBreakdown.totalCostNGN.toLocaleString()} cNGN\n\nPlease fund your wallet: "buy cngn"`;
          }
        }

        // Set awaiting PIN state with enhanced data
        SessionManager.setAwaitingPin(whatsappNumber, {
          type: transactionType,
          data: {
            ...transactionData,
            recipientAddress,
            costBreakdown,
          },
        });

        return `💸 *Send ${transactionData.amount} cNGN*\n\nTo: ${
          transactionData.recipient
        }\nAddress: ${recipientAddress.slice(0, 10)}...\n\n${
          costBreakdown.breakdown
        }\n\n🔐 Enter your PIN to confirm:`;
      } catch (error) {
        logger.error("Error calculating transaction cost:", error);
        return `❌ Failed to calculate transaction cost. Please try again.`;
      }
    }

    // Set awaiting PIN state for other transaction types
    SessionManager.setAwaitingPin(whatsappNumber, {
      type: transactionType,
      data: transactionData,
    });

    return `🔐 *Transaction PIN Required*\n\n${this.getTransactionSummary(
      transactionType,
      transactionData
    )}\n\nPlease enter your 4-digit PIN to confirm:`;
  }

  /**
   * Process pending transaction after PIN verification
   */
  static async processPendingTransaction(
    session: UserSession
  ): Promise<string> {
    const pendingTx = session.pendingTransaction;
    if (!pendingTx) {
      return `❌ No pending transaction found.`;
    }

    try {
      switch (pendingTx.type) {
        case "SEND_MONEY":
          // Import services
          const { FeeService } = await import("../payment/feeService");
          const { UserService } = await import("../user/userService");
          const { CONTRACT_ADDRESSES } = await import("@/config/blockchain");

          // Get user for private key
          const user = await UserService.getUserById(session.userId);
          if (!user || !user.encryptedPrivateKey) {
            return `❌ User wallet not found. Please contact support.`;
          }

          const sendResult = await FeeService.processTransferWithUserPaidFees(
            user.encryptedPrivateKey,
            pendingTx.data.recipientAddress,
            pendingTx.data.amount,
            CONTRACT_ADDRESSES.CNGN_TOKEN || ""
          );

          if (sendResult.success) {
            const fees = sendResult.feesCollected;
            return `✅ *Transfer Successful!*
  💸 Sent: ${pendingTx.data.amount} cNGN
  👤 To: ${pendingTx.data.recipient}
  💰 Service fee: ${fees?.serviceFee.toLocaleString()} cNGN
  ⛽ Gas fee: ${fees?.gasFeeNGN.toLocaleString()} cNGN
  💳 Total cost: ${fees?.totalFees.toLocaleString()} cNGN
  🔗 TX: ${sendResult.txHash?.slice(0, 10)}...
  Your transfer is complete! 🎉`;
          } else {
            return `❌ Transfer failed: ${sendResult.error}
  Please try again or contact support.`;
          }

        case "DEPOSIT_TO_CARD":
          const { CardService: CardServiceDeposit } = await import(
            "../card/cardService"
          );
          const depositResult = await CardServiceDeposit.depositToCard(
            pendingTx.data.cardId,
            pendingTx.data.amount
          );

          if (depositResult.success) {
            return `✅ *Card Funded Successfully!*\n\n💰 Amount: ${
              pendingTx.data.amount
            } cNGN\n💳 Card: ****${pendingTx.data.cardNumber?.slice(
              -4
            )}\n🔗 TX: ${depositResult.txHash?.slice(
              0,
              10
            )}...\n\nYour card is ready to use! 🎉`;
          } else {
            return `❌ Card funding failed: ${depositResult.error}`;
          }

        case "CASH_OUT":
          const cashOutResult = await MockFiatService.initiateCNGNToFiat({
            userId: session.userId,
            amount: pendingTx.data.amount,
            bankAccountId: pendingTx.data.bankAccountId,
          });

          if (cashOutResult.success) {
            return `✅ *Withdrawal Initiated*\n\n💸 Amount: ${pendingTx.data.amount} cNGN\n🏦 Bank: ${pendingTx.data.bankName}\n⏱️ Processing: ${cashOutResult.estimatedTime}\n🔗 Reference: ${cashOutResult.withdrawalReference}\n\nYour money is on the way! 🚀`;
          } else {
            return `❌ Withdrawal failed: ${cashOutResult.error}`;
          }

        case "CARD_WITHDRAWAL":
          const { CardService } = await import("../card/cardService");

          const cardWithdrawResult = await CardService.withdrawFromCard(
            session.userId,
            pendingTx.data.cardId,
            pendingTx.data.amount
          );

          if (cardWithdrawResult.success) {
            const data = cardWithdrawResult.data;
            return `✅ *Card Withdrawal Successful!*\n\n💸 Amount: ${pendingTx.data.amount.toLocaleString()} cNGN\n💳 From: ****${pendingTx.data.cardNumber.slice(
              -4
            )}\n💰 To: Your wallet\n\n${
              data.fees.breakdown
            }\n\nNew card balance: ${data.newCardBalance.toLocaleString()} cNGN\n🔗 TX: ${data.txHash?.slice(
              0,
              10
            )}...\n\nFunds are now in your wallet! 🎉`;
          } else {
            return `❌ Card withdrawal failed: ${cardWithdrawResult.error}`;
          }

        default:
          return `❌ Unknown transaction type: ${pendingTx.type}`;
      }
    } catch (error) {
      logger.error("Error processing pending transaction:", error);
      return `❌ Transaction failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
    }
  }

  /**
   * Get transaction summary for PIN prompt
   */
  private static getTransactionSummary(type: string, data: any): string {
    switch (type) {
      case "SEND_MONEY":
        return `💸 Send ${data.amount} cNGN to ${data.recipient}`;
      case "DEPOSIT_TO_CARD":
        return `💳 Fund card with ${data.amount} cNGN`;
      case "CASH_OUT":
        return `💸 Withdraw ${data.amount} cNGN to bank`;
      case "CARD_WITHDRAWAL":
        return `💸 Withdraw ${
          data.amount
        } cNGN from card ****${data.cardNumber?.slice(-4)} to wallet`;
      default:
        return `Transaction: ${type}`;
    }
  }
}
