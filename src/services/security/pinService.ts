import { prisma } from "@/config/database";
import { logger } from "@/utils/logger";
import bcrypt from "bcrypt";
import crypto from "crypto";

export interface SecurityQuestion {
  id: string;
  question: string;
}

export interface PinSetupData {
  pin: string;
  confirmPin: string;
  securityQuestionId: string;
  securityAnswer: string;
}

export class PinService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly MAX_PIN_ATTEMPTS = 3;
  private static readonly PIN_LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  /**
   * Predefined security questions
   */
  static getSecurityQuestions(): SecurityQuestion[] {
    return [
      { id: "mother_maiden", question: "What is your mother's maiden name?" },
      { id: "first_pet", question: "What was the name of your first pet?" },
      { id: "birth_city", question: "In which city were you born?" },
      {
        id: "first_school",
        question: "What was the name of your first school?",
      },
      { id: "favorite_food", question: "What is your favorite food?" },
      {
        id: "childhood_friend",
        question: "What is the name of your childhood best friend?",
      },
    ];
  }

  /**
   * Validate PIN format
   */
  static validatePinFormat(pin: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!pin || pin.length !== 4) {
      errors.push("PIN must be exactly 4 digits");
    }

    if (!/^\d{4}$/.test(pin)) {
      errors.push("PIN must contain only numbers");
    }

    // Check for weak PINs
    const weakPins = [
      "0000",
      "1111",
      "2222",
      "3333",
      "4444",
      "5555",
      "6666",
      "7777",
      "8888",
      "9999",
      "1234",
      "4321",
      "0123",
      "9876",
    ];
    if (weakPins.includes(pin)) {
      errors.push("PIN is too weak. Avoid sequential or repeated numbers");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Hash PIN securely
   */
  static async hashPin(pin: string): Promise<string> {
    return bcrypt.hash(pin, this.SALT_ROUNDS);
  }

  /**
   * Verify PIN
   */
  static async verifyPin(pin: string, hashedPin: string): Promise<boolean> {
    return bcrypt.compare(pin, hashedPin);
  }

  /**
   * Hash security answer
   */
  static async hashSecurityAnswer(answer: string): Promise<string> {
    // Normalize answer (lowercase, trim)
    const normalizedAnswer = answer.toLowerCase().trim();
    return bcrypt.hash(normalizedAnswer, this.SALT_ROUNDS);
  }

  /**
   * Verify security answer
   */
  static async verifySecurityAnswer(
    answer: string,
    hashedAnswer: string
  ): Promise<boolean> {
    const normalizedAnswer = answer.toLowerCase().trim();
    return bcrypt.compare(normalizedAnswer, hashedAnswer);
  }

  /**
   * Set up PIN and security question for user
   */
  static async setupPin(
    userId: string,
    setupData: PinSetupData
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { pin, confirmPin, securityQuestionId, securityAnswer } = setupData;

      // Validate PIN
      if (pin !== confirmPin) {
        return { success: false, error: "PINs do not match" };
      }

      const pinValidation = this.validatePinFormat(pin);
      if (!pinValidation.valid) {
        return { success: false, error: pinValidation.errors.join(", ") };
      }

      // Validate security question
      const securityQuestions = this.getSecurityQuestions();
      const selectedQuestion = securityQuestions.find(
        (q) => q.id === securityQuestionId
      );
      if (!selectedQuestion) {
        return { success: false, error: "Invalid security question" };
      }

      // Validate security answer
      if (!securityAnswer || securityAnswer.trim().length < 2) {
        return {
          success: false,
          error: "Security answer must be at least 2 characters",
        };
      }

      // Hash PIN and security answer
      const hashedPin = await this.hashPin(pin);
      const hashedSecurityAnswer = await this.hashSecurityAnswer(
        securityAnswer
      );

      // Update user with PIN and security data
      await prisma.user.update({
        where: { id: userId },
        data: {
          metadata: {
            security: {
              pinHash: hashedPin,
              securityQuestionId,
              securityAnswerHash: hashedSecurityAnswer,
              pinSetupAt: new Date().toISOString(),
              pinAttempts: 0,
              pinLockedUntil: null,
            },
          },
        },
      });

      logger.info(`PIN setup completed for user: ${userId}`);

      return { success: true };
    } catch (error) {
      logger.error("Error setting up PIN:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to setup PIN",
      };
    }
  }

  /**
   * Verify user PIN for transactions
   */
  static async verifyUserPin(
    userId: string,
    pin: string
  ): Promise<{
    success: boolean;
    error?: string;
    locked?: boolean;
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { metadata: true },
      });

      if (!user) {
        return { success: false, error: "User not found" };
      }

      const security = (user.metadata as any)?.security;
      if (!security || !security.pinHash) {
        return {
          success: false,
          error: "PIN not set up. Please set up your PIN first.",
        };
      }

      // Check if PIN is locked
      if (security.pinLockedUntil) {
        const lockoutEnd = new Date(security.pinLockedUntil);
        if (new Date() < lockoutEnd) {
          const remainingMinutes = Math.ceil(
            (lockoutEnd.getTime() - Date.now()) / (60 * 1000)
          );
          return {
            success: false,
            locked: true,
            error: `PIN is locked. Try again in ${remainingMinutes} minutes.`,
          };
        }
      }

      // Verify PIN
      const isValidPin = await this.verifyPin(pin, security.pinHash);

      if (isValidPin) {
        // Reset PIN attempts on successful verification
        await this.resetPinAttempts(userId);
        return { success: true };
      } else {
        // Increment PIN attempts
        const newAttempts = (security.pinAttempts || 0) + 1;

        if (newAttempts >= this.MAX_PIN_ATTEMPTS) {
          // Lock PIN
          const lockoutEnd = new Date(Date.now() + this.PIN_LOCKOUT_DURATION);
          await this.lockPin(userId, lockoutEnd);

          return {
            success: false,
            locked: true,
            error: `Too many incorrect attempts. PIN locked for 15 minutes.`,
          };
        } else {
          // Update attempts count
          await this.updatePinAttempts(userId, newAttempts);
          const remainingAttempts = this.MAX_PIN_ATTEMPTS - newAttempts;

          return {
            success: false,
            error: `Incorrect PIN. ${remainingAttempts} attempts remaining.`,
          };
        }
      }
    } catch (error) {
      logger.error("Error verifying PIN:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "PIN verification failed",
      };
    }
  }

  /**
   * Check if user has PIN set up
   */
  static async hasPinSetup(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { metadata: true },
      });

      const security = (user?.metadata as any)?.security;
      return !!(security && security.pinHash);
    } catch (error) {
      logger.error("Error checking PIN setup:", error);
      return false;
    }
  }

  /**
   * Reset PIN (requires security question)
   */
  static async resetPin(
    userId: string,
    securityAnswer: string,
    newPin: string,
    confirmNewPin: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (newPin !== confirmNewPin) {
        return { success: false, error: "New PINs do not match" };
      }

      const pinValidation = this.validatePinFormat(newPin);
      if (!pinValidation.valid) {
        return { success: false, error: pinValidation.errors.join(", ") };
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { metadata: true },
      });

      if (!user) {
        return { success: false, error: "User not found" };
      }

      const security = (user.metadata as any)?.security;
      if (!security || !security.securityAnswerHash) {
        return { success: false, error: "Security question not set up" };
      }

      // Verify security answer
      const isValidAnswer = await this.verifySecurityAnswer(
        securityAnswer,
        security.securityAnswerHash
      );
      if (!isValidAnswer) {
        return { success: false, error: "Incorrect security answer" };
      }

      // Hash new PIN
      const hashedNewPin = await this.hashPin(newPin);

      // Update PIN and reset attempts
      await prisma.user.update({
        where: { id: userId },
        data: {
          metadata: {
            ...((user.metadata as object) || {}),
            security: {
              ...security,
              pinHash: hashedNewPin,
              pinAttempts: 0,
              pinLockedUntil: null,
              pinResetAt: new Date().toISOString(),
            },
          },
        },
      });

      logger.info(`PIN reset completed for user: ${userId}`);

      return { success: true };
    } catch (error) {
      logger.error("Error resetting PIN:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reset PIN",
      };
    }
  }

  /**
   * Update PIN attempts
   */
  private static async updatePinAttempts(
    userId: string,
    attempts: number
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });

    if (user) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          metadata: {
            ...((user.metadata as object) || {}),
            security: {
              ...((user.metadata as any)?.security || {}),
              pinAttempts: attempts,
            },
          },
        },
      });
    }
  }

  /**
   * Reset PIN attempts
   */
  private static async resetPinAttempts(userId: string): Promise<void> {
    await this.updatePinAttempts(userId, 0);
  }

  /**
   * Lock PIN
   */
  private static async lockPin(
    userId: string,
    lockoutEnd: Date
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });

    if (user) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          metadata: {
            ...((user.metadata as object) || {}),
            security: {
              ...((user.metadata as any)?.security || {}),
              pinAttempts: this.MAX_PIN_ATTEMPTS,
              pinLockedUntil: lockoutEnd.toISOString(),
            },
          },
        },
      });
    }
  }

  /**
   * Generate secure random PIN (for admin reset)
   */
  static generateSecurePin(): string {
    let pin: string;
    do {
      pin = crypto.randomInt(1000, 9999).toString().padStart(4, "0");
    } while (!this.validatePinFormat(pin).valid);

    return pin;
  }
}
