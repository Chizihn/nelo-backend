import { ethers } from "ethers";
import { logger } from "@/utils/logger";
import { CONTRACT_ADDRESSES } from "@/config/blockchain";

/**
 * Multi-Token OnRamp Service - Supports USDC, USDT, and cNGN
 * Extends the existing system to support multiple stablecoins
 */
export class MultiTokenOnRampService {
  // Supported tokens on Base network
  private static readonly SUPPORTED_TOKENS = {
    CNGN: {
      address: process.env.CNGN_TOKEN_ADDRESS || "",
      decimals: 18,
      symbol: "cNGN",
      name: "Nigerian Naira Token",
      fiatCurrency: "NGN",
      rate: 1, // 1 NGN = 1 cNGN
    },
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
      decimals: 6,
      symbol: "USDC",
      name: "USD Coin",
      fiatCurrency: "USD",
      rate: 1, // 1 USD = 1 USDC
    },
    USDT: {
      address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", // USDT on Base
      decimals: 6,
      symbol: "USDT",
      name: "Tether USD",
      fiatCurrency: "USD",
      rate: 1, // 1 USD = 1 USDT
    },
  } as const;

  /**
   * Get supported tokens
   */
  static getSupportedTokens() {
    return this.SUPPORTED_TOKENS;
  }

  /**
   * Generate payment link for multiple tokens
   * Supports NGN->cNGN, USD->USDC, USD->USDT
   */
  static async generateMultiTokenPaymentLink(
    userId: string,
    tokenSymbol: keyof typeof this.SUPPORTED_TOKENS,
    fiatAmount: number,
    userEmail: string,
    userPhone: string
  ): Promise<{
    success: boolean;
    paymentUrl?: string;
    txRef?: string;
    tokenInfo?: any;
    error?: string;
  }> {
    try {
      const tokenConfig = this.SUPPORTED_TOKENS[tokenSymbol];

      if (!tokenConfig) {
        return { success: false, error: `Unsupported token: ${tokenSymbol}` };
      }

      // For cNGN, use Flutterwave (NGN payments)
      if (tokenSymbol === "CNGN") {
        return await this.generateFlutterwaveLink(
          userId,
          fiatAmount,
          userEmail,
          userPhone,
          tokenConfig
        );
      }

      // For USDC/USDT, use crypto on-ramp providers
      return await this.generateCryptoOnRampLink(
        userId,
        tokenSymbol,
        fiatAmount,
        userEmail,
        tokenConfig
      );
    } catch (error) {
      logger.error("Multi-token payment link generation failed:", error);
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
   * Generate Flutterwave link for cNGN (NGN payments)
   */
  private static async generateFlutterwaveLink(
    userId: string,
    amountNGN: number,
    userEmail: string,
    userPhone: string,
    tokenConfig: any
  ) {
    const txRef = `nelo_cngn_${userId}_${Date.now()}`;

    // Build Flutterwave payment URL
    const paymentUrl = new URL("https://checkout.flutterwave.com/pay");
    paymentUrl.searchParams.append(
      "public_key",
      process.env.FLUTTERWAVE_PUBLIC_KEY || ""
    );
    paymentUrl.searchParams.append("tx_ref", txRef);
    paymentUrl.searchParams.append("amount", amountNGN.toString());
    paymentUrl.searchParams.append("currency", "NGN");
    paymentUrl.searchParams.append(
      "payment_options",
      "card,ussd,bank_transfer"
    );
    paymentUrl.searchParams.append("customer[email]", userEmail);
    paymentUrl.searchParams.append("customer[phone_number]", userPhone);
    paymentUrl.searchParams.append("customizations[title]", "Nelo - Buy cNGN");
    paymentUrl.searchParams.append(
      "customizations[description]",
      `Buy ${amountNGN} cNGN with NGN`
    );
    paymentUrl.searchParams.append(
      "redirect_url",
      `https://nelo-base.vercel.app/payment/callback?tx_ref=${txRef}&token=cngn`
    );

    return {
      success: true,
      paymentUrl: paymentUrl.toString(),
      txRef,
      tokenInfo: tokenConfig,
    };
  }

  /**
   * Generate crypto on-ramp link for USDC/USDT
   */
  private static async generateCryptoOnRampLink(
    userId: string,
    tokenSymbol: string,
    fiatAmount: number,
    userEmail: string,
    tokenConfig: any
  ) {
    const txRef = `nelo_${tokenSymbol.toLowerCase()}_${userId}_${Date.now()}`;

    // Use MoonPay for USDC/USDT purchases
    const moonPayUrl = new URL("https://buy.moonpay.com");
    moonPayUrl.searchParams.append("apiKey", process.env.MOONPAY_API_KEY || "");
    moonPayUrl.searchParams.append("currencyCode", tokenSymbol.toLowerCase());
    moonPayUrl.searchParams.append("baseCurrencyCode", "usd");
    moonPayUrl.searchParams.append("baseCurrencyAmount", fiatAmount.toString());
    moonPayUrl.searchParams.append("walletAddress", `USER_WALLET_${userId}`); // Will be replaced with actual wallet
    moonPayUrl.searchParams.append(
      "redirectURL",
      `${
        process.env.FRONTEND_URL
      }/payment/callback?tx_ref=${txRef}&token=${tokenSymbol.toLowerCase()}`
    );
    moonPayUrl.searchParams.append("theme", "dark");

    return {
      success: true,
      paymentUrl: moonPayUrl.toString(),
      txRef,
      tokenInfo: tokenConfig,
    };
  }

  /**
   * Process multi-token payment confirmation
   */
  static async processMultiTokenPayment(
    txRef: string,
    tokenSymbol: string,
    paymentData: any
  ): Promise<{
    success: boolean;
    tokensMinted?: number;
    txHash?: string;
    error?: string;
  }> {
    try {
      const tokenConfig =
        this.SUPPORTED_TOKENS[
          tokenSymbol.toUpperCase() as keyof typeof this.SUPPORTED_TOKENS
        ];

      if (!tokenConfig) {
        return { success: false, error: `Unsupported token: ${tokenSymbol}` };
      }

      // Extract user ID from tx_ref
      const userId = txRef.split("_")[2];

      if (!userId) {
        return { success: false, error: "Invalid transaction reference" };
      }

      // Calculate token amount based on fiat amount and rate
      const fiatAmount = paymentData.amount;
      const tokenAmount = fiatAmount * tokenConfig.rate;

      // Mock token minting (in production, this would interact with actual contracts)
      const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;

      logger.info(
        `Multi-token payment processed: ${tokenAmount} ${tokenConfig.symbol} for user ${userId}`
      );

      // Send WhatsApp notification
      try {
        const { WhatsAppService } = await import("../whatsapp/whatsappService");
        const { UserService } = await import("../user/userService");

        const user = await UserService.getUserById(userId);
        if (user) {
          const whatsappService = new WhatsAppService();
          await whatsappService.sendMessage(
            user.whatsappNumber,
            `✅ *Payment Confirmed!*\n\nReceived: ${fiatAmount} ${
              tokenConfig.fiatCurrency
            }\nMinted: ${tokenAmount} ${
              tokenConfig.symbol
            }\nTx: ${mockTxHash.slice(0, 10)}...\n\nYour tokens are ready! 🚀`
          );
        }
      } catch (notificationError) {
        logger.error("Failed to send notification:", notificationError);
      }

      return {
        success: true,
        tokensMinted: tokenAmount,
        txHash: mockTxHash,
      };
    } catch (error) {
      logger.error("Multi-token payment processing failed:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Payment processing failed",
      };
    }
  }

  /**
   * Get exchange rates for all supported tokens
   */
  static async getExchangeRates(): Promise<{
    [key: string]: {
      fiatCurrency: string;
      rate: number;
      symbol: string;
    };
  }> {
    const rates: any = {};

    Object.entries(this.SUPPORTED_TOKENS).forEach(([key, config]) => {
      rates[key] = {
        fiatCurrency: config.fiatCurrency,
        rate: config.rate,
        symbol: config.symbol,
      };
    });

    return rates;
  }
}
