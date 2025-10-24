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
   * Generate payment link for deposits (MISSING FUNCTIONALITY - NOW ADDED)
   */
  async generatePaymentLink(
    userId: string,
    amountNGN: number,
    userEmail: string,
    userPhone: string
  ): Promise<{
    success: boolean;
    paymentUrl?: string;
    txRef?: string;
    error?: string;
  }> {
    try {
      const txRef = `nelo_deposit_${userId}_${Date.now()}`;

      // For demo/testing, use mock credentials
      if (
        !this.publicKey ||
        this.publicKey === "your_flutterwave_public_key_here"
      ) {
        logger.warn("Using mock Flutterwave payment link for demo");
        return {
          success: true,
          paymentUrl: `https://checkout.flutterwave.com/pay?mock=true&amount=${amountNGN}&tx_ref=${txRef}`,
          txRef,
        };
      }

      // Build real Flutterwave payment URL
      const paymentUrl = new URL("https://checkout.flutterwave.com/pay");
      paymentUrl.searchParams.append("public_key", this.publicKey);
      paymentUrl.searchParams.append("tx_ref", txRef);
      paymentUrl.searchParams.append("amount", amountNGN.toString());
      paymentUrl.searchParams.append("currency", "NGN");
      paymentUrl.searchParams.append(
        "payment_options",
        "card,ussd,bank_transfer"
      );
      paymentUrl.searchParams.append("customer[email]", userEmail);
      paymentUrl.searchParams.append("customer[phone_number]", userPhone);
      paymentUrl.searchParams.append("customer[name]", `Nelo User ${userId}`);
      paymentUrl.searchParams.append(
        "customizations[title]",
        "Nelo - Buy cNGN"
      );
      paymentUrl.searchParams.append(
        "customizations[description]",
        `Buy ${amountNGN.toLocaleString()} cNGN with NGN`
      );
      paymentUrl.searchParams.append(
        "customizations[logo]",
        "https://nelo-base.vercel.app/logo.png"
      );

      // IMPORTANT: Use your frontend URL for callback
      paymentUrl.searchParams.append(
        "redirect_url",
        `https://nelo-base.vercel.app/payment/callback?tx_ref=${txRef}`
      );

      logger.info(`Payment link generated for user ${userId}: ${txRef}`);

      return {
        success: true,
        paymentUrl: paymentUrl.toString(),
        txRef,
      };
    } catch (error) {
      logger.error("Payment link generation failed:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Payment link generation failed",
      };
    }
  }

  /**
   * Verify transaction by reference
   */
  async verifyTransactionByRef(txRef: string): Promise<{
    success: boolean;
    status?: string;
    amount?: number;
    currency?: string;
    error?: string;
  }> {
    try {
      if (
        !this.secretKey ||
        this.secretKey === "your_flutterwave_secret_key_here"
      ) {
        // Mock verification for demo
        logger.warn("Using mock transaction verification");
        return {
          success: true,
          status: "successful",
          amount: 1000, // Mock amount
          currency: "NGN",
        };
      }

      const response = await axios.get(
        `${this.baseURL}/transactions/verify_by_reference?tx_ref=${txRef}`,
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
          currency: response.data.data.currency,
        };
      }

      return { success: false, error: response.data.message };
    } catch (error) {
      logger.error("Transaction verification error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Verification failed",
      };
    }
  }

  /**
   * Initiate bank transfer for cNGN purchase
   */
  async initiateBankTransfer(request: {
    userId: string;
    amount: number;
    currency: string;
    email: string;
    phoneNumber: string;
    fullName: string;
  }): Promise<{
    success: boolean;
    paymentInstructions?: string;
    paymentReference?: string;
    error?: string;
  }> {
    try {
      const { userId, amount, currency, email, phoneNumber, fullName } =
        request;

      // Generate payment reference
      const paymentReference = `nelo_deposit_${userId}_${Date.now()}`;

      // For demo purposes, return mock bank transfer instructions
      const paymentInstructions = `*Transfer ₦${amount.toLocaleString()} to:*

  🏦 Account: 0067100155
  🏛️ Bank: Wema Bank
  👤 Name: Your Nelo Account
  📋 Reference: ${paymentReference}

  ⚠️ *Important:*
  • Transfer the exact amount: ₦${amount.toLocaleString()}
  • Use the reference above
  • Transfer will be processed within 5 minutes

  *After making the transfer:*
  Type "paid ${amount}" to confirm your payment`;

      logger.info(
        `Bank transfer initiated: ${paymentReference} for ₦${amount}`
      );

      return {
        success: true,
        paymentInstructions,
        paymentReference,
      };
    } catch (error) {
      logger.error("Error initiating bank transfer:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to initiate bank transfer",
      };
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
