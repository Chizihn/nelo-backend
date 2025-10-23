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
        // Validate and store PIN
        const pinValidation = PinService.validatePinFormat(message);
        if (!pinValidation.valid) {
          return `❌ ${pinValidation.errors.join(
            "\n"
          )}\n\nPlease enter a valid 4-digit PIN:`;
        }

        SessionManager.advanceFlow(whatsappNumber, { pin: message });
        return `✅ PIN accepted!\n\nPlease confirm your PIN by entering it again:`;

      case 3:
        // Confirm PIN
        if (message !== flowData.pin) {
          SessionManager.updateSession(whatsappNumber, { flowStep: 2 });
          return `❌ PINs don't match!\n\nPlease enter your 4-digit PIN again:`;
        }

        SessionManager.advanceFlow(whatsappNumber, { confirmPin: message });

        // Show security questions
        const questions = PinService.getSecurityQuestions();
        let questionsList = `🔒 *Choose a Security Question*\n\nThis helps recover your PIN if forgotten:\n\n`;

        questions.forEach((q, index) => {
          questionsList += `${index + 1}. ${q.question}\n`;
        });

        questionsList += `\nReply with the number (1-${questions.length}):`;

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
          return `🎉 *PIN Setup Complete!*

✅ Your transaction PIN is now active
✅ Security question configured

*Your account is now secure!*

You can now:
• Create virtual cards
• Make transactions
• Access all features

Type "create card" to get started! 🚀`;
        } else {
          return `❌ PIN setup failed: ${setupResult.error}\n\nPlease try again by typing "setup pin"`;
        }

      default:
        SessionManager.completeFlow(whatsappNumber);
        return `❌ Something went wrong. Please start over by typing "setup pin"`;
    }
  }

  /**
   * Handle KYC verification flow
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
        // Welcome to KYC
        SessionManager.advanceFlow(whatsappNumber);
        return `🆔 *Identity Verification*

To comply with regulations and secure your account, we need to verify your identity.

*Required Information:*
• Full name
• ID number (optional for demo)

*Benefits after verification:*
✅ Create virtual cards
✅ Higher transaction limits
✅ Full access to features

Please enter your *first name*:`;

      case 2:
        // First name
        if (!message || message.trim().length < 2) {
          return `❌ Please enter a valid first name (at least 2 characters):`;
        }

        SessionManager.advanceFlow(whatsappNumber, {
          firstName: message.trim(),
        });
        return `✅ First name: ${message.trim()}\n\nNow enter your *last name*:`;

      case 3:
        // Last name
        if (!message || message.trim().length < 2) {
          return `❌ Please enter a valid last name (at least 2 characters):`;
        }

        SessionManager.advanceFlow(whatsappNumber, {
          lastName: message.trim(),
        });
        return `✅ Last name: ${message.trim()}\n\nOptional: Enter your *ID number* or type "skip":`;

      case 4:
        // ID number (optional)
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
          return `🎉 *Identity Verified Successfully!*

✅ Name: ${flowData.firstName} ${flowData.lastName}
✅ KYC Level: ${kycResult.level}
${idNumber ? `✅ ID: ${idNumber}` : ""}

*Your new limits:*
💰 Daily: ₦1,000,000
📅 Monthly: ₦10,000,000
💳 Cards: 5 cards

*Next Steps:*
${
  (await PinService.hasPinSetup(session.userId))
    ? '• Create your first card: "create card"'
    : '• Set up your PIN: "setup pin"'
}
• Add bank account: "add bank"
• Buy cNGN: "buy cngn"

Welcome to Nelo! 🚀`;
        } else {
          return `❌ Verification failed: ${kycResult.error}\n\nPlease try again by typing "verify id"`;
        }

      default:
        SessionManager.completeFlow(whatsappNumber);
        return `❌ Something went wrong. Please start over by typing "verify id"`;
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

    // Set awaiting PIN state
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
          const sendResult = await CardService.sendMoney(
            session.userId,
            pendingTx.data.amount,
            pendingTx.data.recipient
          );

          if (sendResult.success) {
            return `✅ *Money Sent Successfully!*\n\n💸 Amount: ${
              pendingTx.data.amount
            } cNGN\n📍 To: ${
              pendingTx.data.recipient
            }\n🔗 TX: ${sendResult.txHash?.slice(
              0,
              10
            )}...\n\nView on explorer: https://sepolia.basescan.org/tx/${
              sendResult.txHash
            }`;
          } else {
            return `❌ Transfer failed: ${sendResult.error}`;
          }

        case "DEPOSIT_TO_CARD":
          const depositResult = await CardService.depositToCard(
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
      default:
        return `Transaction: ${type}`;
    }
  }
}
