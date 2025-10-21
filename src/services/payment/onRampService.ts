import axios from "axios";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";
import { OnRampRequest } from "@/types/card.types";

export class OnRampService {
  private static readonly PROVIDERS = {
    MOONPAY: "moonpay",
    TRANSAK: "transak",
    RAMP: "ramp",
  } as const;

  /**
   * Generate on-ramp URL for user to buy cNGN with NGN
   */
  static async generateOnRampUrl(request: OnRampRequest): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    try {
      const provider = env.ONRAMP_PROVIDER || this.PROVIDERS.MOONPAY;

      switch (provider) {
        case this.PROVIDERS.MOONPAY:
          return await this.generateMoonPayUrl(request);
        case this.PROVIDERS.TRANSAK:
          return await this.generateTransakUrl(request);
        case this.PROVIDERS.RAMP:
          return await this.generateRampUrl(request);
        default:
          return { success: false, error: "Unsupported on-ramp provider" };
      }
    } catch (error) {
      logger.error("Error generating on-ramp URL:", error);
      return { success: false, error: "Failed to generate on-ramp URL" };
    }
  }

  /**
   * Generate MoonPay on-ramp URL
   */
  private static async generateMoonPayUrl(request: OnRampRequest): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    try {
      // MoonPay parameters for cNGN purchase
      const params = new URLSearchParams({
        apiKey: env.ONRAMP_API_KEY || "",
        currencyCode: "cngn", // cNGN token
        baseCurrencyCode: "ngn", // Nigerian Naira
        baseCurrencyAmount: request.amount,
        walletAddress: request.userId, // User's wallet address
        redirectURL:
          request.returnUrl ||
          `${env.BASE_URL || "http://localhost:3000"}/onramp/success`,
        theme: "dark",
        showWalletAddressForm: "false",
      });

      const url = `https://buy.moonpay.com?${params.toString()}`;

      return { success: true, url };
    } catch (error) {
      logger.error("Error generating MoonPay URL:", error);
      return { success: false, error: "Failed to generate MoonPay URL" };
    }
  }

  /**
   * Generate Transak on-ramp URL
   */
  private static async generateTransakUrl(request: OnRampRequest): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    try {
      const params = new URLSearchParams({
        apiKey: env.ONRAMP_API_KEY || "",
        defaultCryptoCurrency: "cNGN",
        defaultFiatCurrency: "NGN",
        defaultFiatAmount: request.amount,
        walletAddress: request.userId,
        redirectURL:
          request.returnUrl ||
          `${env.BASE_URL || "http://localhost:3000"}/onramp/success`,
        hideMenu: "true",
        themeColor: "000000",
      });

      const url = `https://global.transak.com/?${params.toString()}`;

      return { success: true, url };
    } catch (error) {
      logger.error("Error generating Transak URL:", error);
      return { success: false, error: "Failed to generate Transak URL" };
    }
  }

  /**
   * Generate Ramp on-ramp URL
   */
  private static async generateRampUrl(request: OnRampRequest): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    try {
      const params = new URLSearchParams({
        hostApiKey: env.ONRAMP_API_KEY || "",
        defaultAsset: "BASE_cNGN", // cNGN on Base network
        fiatCurrency: "NGN",
        fiatValue: request.amount,
        userAddress: request.userId,
        finalUrl:
          request.returnUrl ||
          `${env.BASE_URL || "http://localhost:3000"}/onramp/success`,
      });

      const url = `https://app.ramp.network/?${params.toString()}`;

      return { success: true, url };
    } catch (error) {
      logger.error("Error generating Ramp URL:", error);
      return { success: false, error: "Failed to generate Ramp URL" };
    }
  }

  /**
   * Verify on-ramp transaction completion
   */
  static async verifyOnRampTransaction(transactionId: string): Promise<{
    success: boolean;
    amount?: string;
    status?: string;
    error?: string;
  }> {
    try {
      const provider = env.ONRAMP_PROVIDER || this.PROVIDERS.MOONPAY;

      switch (provider) {
        case this.PROVIDERS.MOONPAY:
          return await this.verifyMoonPayTransaction(transactionId);
        default:
          return {
            success: false,
            error: "Transaction verification not implemented for this provider",
          };
      }
    } catch (error) {
      logger.error("Error verifying on-ramp transaction:", error);
      return { success: false, error: "Failed to verify transaction" };
    }
  }

  /**
   * Verify MoonPay transaction
   */
  private static async verifyMoonPayTransaction(
    transactionId: string
  ): Promise<{
    success: boolean;
    amount?: string;
    status?: string;
    error?: string;
  }> {
    try {
      const response = await axios.get(
        `https://api.moonpay.com/v1/transactions/${transactionId}`,
        {
          headers: {
            Authorization: `Api-Key ${env.ONRAMP_API_KEY}`,
          },
        }
      );

      const transaction = response.data;

      return {
        success: true,
        amount: transaction.quoteCurrencyAmount?.toString(),
        status: transaction.status,
      };
    } catch (error) {
      logger.error("Error verifying MoonPay transaction:", error);
      return { success: false, error: "Failed to verify MoonPay transaction" };
    }
  }

  /**
   * Get supported currencies for on-ramp
   */
  static async getSupportedCurrencies(): Promise<{
    fiat: string[];
    crypto: string[];
  }> {
    return {
      fiat: ["NGN", "USD", "EUR", "GBP"], // Supported fiat currencies
      crypto: ["cNGN"], // Supported crypto currencies
    };
  }

  /**
   * Get exchange rate NGN to cNGN
   */
  static async getExchangeRate(): Promise<{
    rate: number;
    fee: number;
  }> {
    // cNGN is 1:1 pegged to NGN, but there might be small fees
    return {
      rate: 1.0, // 1 NGN = 1 cNGN
      fee: 0.01, // 1% fee
    };
  }
}
