import axios from "axios";
import { logger } from "@/utils/logger";
import { config } from "dotenv";

config();

export interface VirtualAccount {
  accountNumber: string;
  bankName: string;
  accountName: string;
  accountReference: string;
  currency: string;
  status: string;
}

export interface FlutterwaveWebhookPayload {
  event: string;
  data: {
    id: number;
    txRef: string;
    flwRef: string;
    orderRef: string;
    paymentPlan: string;
    createdAt: string;
    amount: number;
    charged_amount: number;
    status: string;
    IP: string;
    currency: string;
    customer: {
      id: number;
      phone_number: string;
      name: string;
      email: string;
    };
    entity: {
      account_number: string;
      bank_name: string;
    };
  };
}

export class FlutterwaveService {
  private static instance: FlutterwaveService;
  private baseURL: string;
  private secretKey: string;
  private publicKey: string;

  constructor() {
    this.baseURL =
      process.env.FLUTTERWAVE_ENVIRONMENT === "production"
        ? "https://api.flutterwave.com/v3"
        : "https://api.flutterwave.com/v3"; // Same URL for sandbox

    this.secretKey = process.env.FLUTTERWAVE_SECRET_KEY || "";
    this.publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY || "";

    if (!this.secretKey || !this.publicKey) {
      logger.warn("Flutterwave credentials not configured, using mock service");
    }
  }

  static getInstance(): FlutterwaveService {
    if (!FlutterwaveService.instance) {
      FlutterwaveService.instance = new FlutterwaveService();
    }
    return FlutterwaveService.instance;
  }

  /**
   * Create virtual account for user
   */
  async createVirtualAccount(
    userId: string,
    email: string,
    phoneNumber: string,
    firstName: string,
    lastName: string
  ): Promise<{
    success: boolean;
    account?: VirtualAccount;
    error?: string;
  }> {
    try {
      // For hackathon demo, use mock virtual account
      if (
        !this.secretKey ||
        this.secretKey === "your_flutterwave_secret_key_here"
      ) {
        logger.warn("Using mock Flutterwave virtual account for demo");
        return this.createMockVirtualAccount(userId, firstName, lastName);
      }

      const payload = {
        email,
        is_permanent: true,
        bvn: this.generateMockBVN(), // In production, get real BVN from user
        tx_ref: `nelo_va_${userId}_${Date.now()}`,
        phonenumber: phoneNumber,
        firstname: firstName,
        lastname: lastName,
        narration: `Nelo Virtual Account - ${firstName} ${lastName}`,
      };

      const response = await axios.post(
        `${this.baseURL}/virtual-account-numbers`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status === "success") {
        const accountData = response.data.data;

        const virtualAccount: VirtualAccount = {
          accountNumber: accountData.account_number,
          bankName: accountData.bank_name,
          accountName: accountData.account_name,
          accountReference: accountData.account_reference,
          currency: "NGN",
          status: "active",
        };

        logger.info(
          `Virtual account created for user ${userId}: ${accountData.account_number}`
        );

        return {
          success: true,
          account: virtualAccount,
        };
      } else {
        return {
          success: false,
          error: response.data.message || "Failed to create virtual account",
        };
      }
    } catch (error) {
      logger.error("Error creating Flutterwave virtual account:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create virtual account",
      };
    }
  }

  /**
   * Get virtual account details
   */
  async getVirtualAccount(accountReference: string): Promise<{
    success: boolean;
    account?: VirtualAccount;
    error?: string;
  }> {
    try {
      if (
        !this.secretKey ||
        this.secretKey === "your_flutterwave_secret_key_here"
      ) {
        return {
          success: false,
          error: "Virtual account not found",
        };
      }

      const response = await axios.get(
        `${this.baseURL}/virtual-account-numbers/${accountReference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        }
      );

      if (response.data.status === "success") {
        const accountData = response.data.data;

        const virtualAccount: VirtualAccount = {
          accountNumber: accountData.account_number,
          bankName: accountData.bank_name,
          accountName: accountData.account_name,
          accountReference: accountData.account_reference,
          currency: "NGN",
          status: accountData.status,
        };

        return {
          success: true,
          account: virtualAccount,
        };
      } else {
        return {
          success: false,
          error: response.data.message || "Virtual account not found",
        };
      }
    } catch (error) {
      logger.error("Error getting virtual account:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get virtual account",
      };
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const crypto = require("crypto");
      const hash = crypto
        .createHmac("sha256", this.secretKey)
        .update(payload)
        .digest("hex");

      return hash === signature;
    } catch (error) {
      logger.error("Error verifying Flutterwave webhook signature:", error);
      return false;
    }
  }

  /**
   * Process webhook payment notification
   */
  async processWebhookPayment(payload: FlutterwaveWebhookPayload): Promise<{
    success: boolean;
    shouldCreditUser: boolean;
    amount?: number;
    userId?: string;
    error?: string;
  }> {
    try {
      const { event, data } = payload;

      if (event !== "charge.completed") {
        return {
          success: true,
          shouldCreditUser: false,
        };
      }

      // Verify transaction with Flutterwave
      const verificationResult = await this.verifyTransaction(data.id);

      if (
        !verificationResult.success ||
        verificationResult.status !== "successful"
      ) {
        return {
          success: false,
          shouldCreditUser: false,
          error: "Transaction verification failed",
        };
      }

      // Extract user ID from transaction reference
      const userId = this.extractUserIdFromTxRef(data.txRef);

      if (!userId) {
        return {
          success: false,
          shouldCreditUser: false,
          error: "Invalid transaction reference",
        };
      }

      return {
        success: true,
        shouldCreditUser: true,
        amount: data.amount,
        userId,
      };
    } catch (error) {
      logger.error("Error processing Flutterwave webhook:", error);
      return {
        success: false,
        shouldCreditUser: false,
        error:
          error instanceof Error ? error.message : "Webhook processing failed",
      };
    }
  }

  /**
   * Verify transaction status
   */
  private async verifyTransaction(transactionId: number): Promise<{
    success: boolean;
    status?: string;
    amount?: number;
  }> {
    try {
      const response = await axios.get(
        `${this.baseURL}/transactions/${transactionId}/verify`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        }
      );

      if (response.data.status === "success") {
        return {
          success: true,
          status: response.data.data.status,
          amount: response.data.data.amount,
        };
      }

      return { success: false };
    } catch (error) {
      logger.error("Error verifying transaction:", error);
      return { success: false };
    }
  }

  /**
   * Extract user ID from transaction reference
   */
  private extractUserIdFromTxRef(txRef: string): string | null {
    try {
      // Expected format: nelo_deposit_userId_timestamp
      const parts = txRef.split("_");
      if (parts.length >= 3 && parts[0] === "nelo") {
        return parts[2];
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create mock virtual account for demo
   */
  private createMockVirtualAccount(
    userId: string,
    firstName: string,
    lastName: string
  ): {
    success: boolean;
    account: VirtualAccount;
  } {
    const mockAccount: VirtualAccount = {
      accountNumber: this.generateMockAccountNumber(),
      bankName: "Wema Bank",
      accountName: `${firstName} ${lastName}`,
      accountReference: `nelo_va_${userId}_${Date.now()}`,
      currency: "NGN",
      status: "active",
    };

    logger.info(`Mock virtual account created: ${mockAccount.accountNumber}`);

    return {
      success: true,
      account: mockAccount,
    };
  }

  /**
   * Generate mock account number
   */
  private generateMockAccountNumber(): string {
    return "99" + Math.random().toString().slice(2, 10);
  }

  /**
   * Generate mock BVN for demo
   */
  private generateMockBVN(): string {
    return Math.random().toString().slice(2, 13);
  }

  /**
   * Get supported banks for withdrawals
   */
  async getSupportedBanks(): Promise<
    Array<{
      id: number;
      code: string;
      name: string;
    }>
  > {
    try {
      if (
        !this.secretKey ||
        this.secretKey === "your_flutterwave_secret_key_here"
      ) {
        return this.getMockBanks();
      }

      const response = await axios.get(`${this.baseURL}/banks/NG`, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      if (response.data.status === "success") {
        return response.data.data;
      }

      return this.getMockBanks();
    } catch (error) {
      logger.error("Error getting supported banks:", error);
      return this.getMockBanks();
    }
  }

  /**
   * Get mock banks for demo
   */
  private getMockBanks(): Array<{
    id: number;
    code: string;
    name: string;
  }> {
    return [
      { id: 1, code: "058", name: "Guaranty Trust Bank" },
      { id: 2, code: "044", name: "Access Bank" },
      { id: 3, code: "033", name: "United Bank For Africa" },
      { id: 4, code: "057", name: "Zenith Bank" },
      { id: 5, code: "011", name: "First Bank of Nigeria" },
      { id: 6, code: "214", name: "First City Monument Bank" },
      { id: 7, code: "221", name: "Stanbic IBTC Bank" },
      { id: 8, code: "035", name: "Wema Bank" },
      { id: 9, code: "232", name: "Sterling Bank" },
      { id: 10, code: "032", name: "Union Bank of Nigeria" },
    ];
  }
}

export const flutterwaveService = FlutterwaveService.getInstance();
