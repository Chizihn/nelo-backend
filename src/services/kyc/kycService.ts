import { prisma } from "@/config/database";
import { logger } from "@/utils/logger";

export interface KYCData {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  idNumber?: string;
  idType?: "NIN" | "BVN" | "PASSPORT" | "DRIVERS_LICENSE";
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface KYCResult {
  success: boolean;
  level: "NONE" | "BASIC" | "VERIFIED" | "PREMIUM";
  error?: string;
  data?: any;
}

export class KYCService {
  /**
   * Mock KYC verification for hackathon demo
   */
  static async verifyUser(
    userId: string,
    kycData: KYCData
  ): Promise<KYCResult> {
    try {
      logger.info(`Starting mock KYC verification for user: ${userId}`);

      // Mock verification process
      await this.simulateKYCProcess();

      // Update user with KYC data
      await prisma.user.update({
        where: { id: userId },
        data: {
          firstName: kycData.firstName,
          lastName: kycData.lastName,
          metadata: {
            kyc: {
              verified: true,
              level: "VERIFIED",
              verifiedAt: new Date().toISOString(),
              data: JSON.parse(JSON.stringify(kycData)),
              mock: true, // Flag to indicate this is mock data
            },
          },
        },
      });

      logger.info(`Mock KYC verification completed for user: ${userId}`);

      return {
        success: true,
        level: "VERIFIED",
        data: {
          verifiedAt: new Date().toISOString(),
          level: "VERIFIED",
          limits: {
            dailyLimit: 1000000, // 1M NGN
            monthlyLimit: 10000000, // 10M NGN
            cardCreationLimit: 5,
          },
        },
      };
    } catch (error) {
      logger.error("Error in mock KYC verification:", error);
      return {
        success: false,
        level: "NONE",
        error:
          error instanceof Error ? error.message : "KYC verification failed",
      };
    }
  }

  /**
   * Check user's KYC status
   */
  static async getKYCStatus(userId: string): Promise<{
    verified: boolean;
    level: "NONE" | "BASIC" | "VERIFIED" | "PREMIUM";
    data?: any;
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { metadata: true, firstName: true, lastName: true },
      });

      if (!user) {
        return { verified: false, level: "NONE" };
      }

      const kycData = (user.metadata as any)?.kyc;

      if (!kycData || !kycData.verified) {
        return { verified: false, level: "NONE" };
      }

      return {
        verified: true,
        level: kycData.level || "BASIC",
        data: kycData,
      };
    } catch (error) {
      logger.error("Error getting KYC status:", error);
      return { verified: false, level: "NONE" };
    }
  }

  /**
   * Get KYC limits based on verification level
   */
  static getKYCLimits(level: "NONE" | "BASIC" | "VERIFIED" | "PREMIUM"): {
    dailyLimit: number;
    monthlyLimit: number;
    cardCreationLimit: number;
    withdrawalLimit: number;
  } {
    const limits = {
      NONE: {
        dailyLimit: 0,
        monthlyLimit: 0,
        cardCreationLimit: 0,
        withdrawalLimit: 0,
      },
      BASIC: {
        dailyLimit: 50000, // 50K NGN
        monthlyLimit: 500000, // 500K NGN
        cardCreationLimit: 1,
        withdrawalLimit: 25000, // 25K NGN
      },
      VERIFIED: {
        dailyLimit: 1000000, // 1M NGN
        monthlyLimit: 10000000, // 10M NGN
        cardCreationLimit: 5,
        withdrawalLimit: 500000, // 500K NGN
      },
      PREMIUM: {
        dailyLimit: 5000000, // 5M NGN
        monthlyLimit: 50000000, // 50M NGN
        cardCreationLimit: 10,
        withdrawalLimit: 2000000, // 2M NGN
      },
    };

    return limits[level];
  }

  /**
   * Check if user can perform action based on KYC level
   */
  static async canPerformAction(
    userId: string,
    action: "CREATE_CARD" | "DEPOSIT" | "WITHDRAW" | "TRANSFER",
    amount?: number
  ): Promise<{
    allowed: boolean;
    reason?: string;
    requiredLevel?: string;
  }> {
    try {
      const kycStatus = await this.getKYCStatus(userId);
      const limits = this.getKYCLimits(kycStatus.level);

      switch (action) {
        case "CREATE_CARD":
          if (kycStatus.level === "NONE") {
            return {
              allowed: false,
              reason: "KYC verification required to create cards",
              requiredLevel: "BASIC",
            };
          }
          return { allowed: true };

        case "DEPOSIT":
          if (kycStatus.level === "NONE") {
            return {
              allowed: false,
              reason: "KYC verification required for deposits",
              requiredLevel: "BASIC",
            };
          }
          if (amount && amount > limits.dailyLimit) {
            return {
              allowed: false,
              reason: `Daily limit exceeded. Maximum: ₦${limits.dailyLimit.toLocaleString()}`,
              requiredLevel:
                kycStatus.level === "BASIC" ? "VERIFIED" : "PREMIUM",
            };
          }
          return { allowed: true };

        case "WITHDRAW":
          if (kycStatus.level === "NONE") {
            return {
              allowed: false,
              reason: "KYC verification required for withdrawals",
              requiredLevel: "BASIC",
            };
          }
          if (amount && amount > limits.withdrawalLimit) {
            return {
              allowed: false,
              reason: `Withdrawal limit exceeded. Maximum: ₦${limits.withdrawalLimit.toLocaleString()}`,
              requiredLevel:
                kycStatus.level === "BASIC" ? "VERIFIED" : "PREMIUM",
            };
          }
          return { allowed: true };

        case "TRANSFER":
          if (kycStatus.level === "NONE") {
            return {
              allowed: false,
              reason: "KYC verification required for transfers",
              requiredLevel: "BASIC",
            };
          }
          return { allowed: true };

        default:
          return { allowed: false, reason: "Unknown action" };
      }
    } catch (error) {
      logger.error("Error checking KYC permissions:", error);
      return { allowed: false, reason: "Error checking permissions" };
    }
  }

  /**
   * Simulate KYC verification process (for demo)
   */
  private static async simulateKYCProcess(): Promise<void> {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // In a real implementation, this would:
    // 1. Validate ID documents
    // 2. Perform background checks
    // 3. Verify identity with third-party services
    // 4. Check against sanctions lists
    // 5. Assign appropriate KYC level

    logger.info("Mock KYC verification process completed");
  }

  /**
   * Generate mock ID for demo purposes
   */
  static generateMockID(): string {
    const prefix = "ID";
    const numbers = Math.random().toString().slice(2, 11);
    return `${prefix}${numbers}`;
  }
}
