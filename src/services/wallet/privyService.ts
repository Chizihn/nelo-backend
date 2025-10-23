import { PrivyApi } from "@privy-io/server-auth";
import { logger } from "@/utils/logger";
import { config } from "dotenv";

config();

export interface PrivyWallet {
  address: string;
  walletClientType: string;
  connectorType: string;
  recoveryMethod: string;
}

export interface PrivyUser {
  id: string;
  createdAt: string;
  linkedAccounts: any[];
  wallet?: PrivyWallet;
}

export class PrivyService {
  private static instance: PrivyService;
  private privy: PrivyApi;

  constructor() {
    if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
      throw new Error(
        "Privy configuration missing. Please set PRIVY_APP_ID and PRIVY_APP_SECRET"
      );
    }

    this.privy = new PrivyApi({
      appId: process.env.PRIVY_APP_ID,
      appSecret: process.env.PRIVY_APP_SECRET,
    });
  }

  static getInstance(): PrivyService {
    if (!PrivyService.instance) {
      PrivyService.instance = new PrivyService();
    }
    return PrivyService.instance;
  }

  /**
   * Create a new Privy user with embedded wallet
   */
  async createUserWithWallet(whatsappNumber: string): Promise<{
    success: boolean;
    user?: PrivyUser;
    error?: string;
  }> {
    try {
      // Create user with phone number and embedded wallet
      const user = await this.privy.createUser({
        linkedAccounts: [
          {
            type: "phone",
            phoneNumber: whatsappNumber,
          },
        ],
        createEmbeddedWallet: true,
      });

      logger.info(
        `Privy user created: ${user.id} with wallet ${user.wallet?.address}`
      );

      return {
        success: true,
        user: user as PrivyUser,
      };
    } catch (error) {
      logger.error("Error creating Privy user:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Privy user",
      };
    }
  }

  /**
   * Get existing Privy user by phone number
   */
  async getUserByPhone(whatsappNumber: string): Promise<{
    success: boolean;
    user?: PrivyUser;
    error?: string;
  }> {
    try {
      const users = await this.privy.getUsers({
        linkedAccounts: [
          {
            type: "phone",
            phoneNumber: whatsappNumber,
          },
        ],
      });

      if (users.length === 0) {
        return { success: false, error: "User not found" };
      }

      return {
        success: true,
        user: users[0] as PrivyUser,
      };
    } catch (error) {
      logger.error("Error getting Privy user:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get Privy user",
      };
    }
  }

  /**
   * Sign transaction using Privy embedded wallet
   */
  async signTransaction(
    userId: string,
    transaction: any
  ): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
  }> {
    try {
      // Use Privy's signing methods for embedded wallets
      const signature = await this.privy.signTransaction(userId, transaction);

      return {
        success: true,
        signature,
      };
    } catch (error) {
      logger.error("Error signing transaction with Privy:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to sign transaction",
      };
    }
  }

  /**
   * Get user's wallet balance
   */
  async getWalletBalance(
    userId: string,
    tokenAddress?: string
  ): Promise<{
    success: boolean;
    balance?: string;
    error?: string;
  }> {
    try {
      // For now, delegate to blockchain service
      // In production, use Privy's wallet methods
      logger.info(`Getting balance for Privy user ${userId}`);

      return {
        success: true,
        balance: "0", // Placeholder - use CngnService.getBalance in production
      };
    } catch (error) {
      logger.error("Error getting wallet balance:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get balance",
      };
    }
  }
}

export const privyService = PrivyService.getInstance();
