import { Router, Request, Response } from "express";
import { logger } from "@/utils/logger";
import { flutterwaveService } from "@/services/payment/flutterwaveService";
import { IntegratedOnRampService } from "@/services/payment/integratedOnRampService";
import { MultiTokenOnRampService } from "@/services/payment/multiTokenOnRampService";

const router = Router();

/**
 * Handle payment callback from frontend
 * This endpoint receives callbacks from https://nelo-base.vercel.app
 */
router.post("/callback", async (req: Request, res: Response) => {
  try {
    const { tx_ref, status, token = "cngn" } = req.body;

    if (!tx_ref) {
      return res.status(400).json({
        success: false,
        error: "Missing transaction reference",
      });
    }

    logger.info(
      `Payment callback received from frontend: ${tx_ref}, status: ${status}, token: ${token}`
    );

    // Verify transaction based on token type
    let verificationResult;

    if (token.toLowerCase() === "cngn") {
      // Verify with Flutterwave for cNGN (NGN payments)
      verificationResult = await flutterwaveService.verifyTransactionByRef(
        tx_ref
      );
    } else {
      // For USDC/USDT, verify with crypto providers (MoonPay, etc.)
      // This would be implemented based on the specific provider
      verificationResult = { success: true, status: "successful", amount: 100 }; // Mock for now
    }

    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Transaction verification failed",
      });
    }

    if (verificationResult.status !== "successful") {
      return res.status(400).json({
        success: false,
        error: `Transaction not successful: ${verificationResult.status}`,
      });
    }

    // Process the payment based on token type
    let processResult;

    if (token.toLowerCase() === "cngn") {
      // Process cNGN payment
      processResult = await IntegratedOnRampService.confirmPaymentAndMintCNGN(
        tx_ref
      );
    } else {
      // Process multi-token payment (USDC/USDT)
      processResult = await MultiTokenOnRampService.processMultiTokenPayment(
        tx_ref,
        token,
        verificationResult
      );
    }

    if (processResult.success) {
      logger.info(`Payment processed successfully: ${tx_ref}`);
      return res.status(200).json({
        success: true,
        message: "Payment processed successfully",
        data: {
          txRef: tx_ref,
          tokensMinted:
            (processResult as any).cngnAmount ||
            (processResult as any).tokensMinted,
          txHash: processResult.txHash,
        },
      });
    } else {
      logger.error(`Payment processing failed: ${processResult.error}`);
      return res.status(500).json({
        success: false,
        error: processResult.error || "Payment processing failed",
      });
    }
  } catch (error) {
    logger.error("Payment callback error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * Generate payment link endpoint
 */
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { userId, amount, token = "cngn", userEmail, userPhone } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userId, amount",
      });
    }

    let result;

    if (token.toLowerCase() === "cngn") {
      // Generate Flutterwave link for cNGN
      result = await flutterwaveService.generatePaymentLink(
        userId,
        parseFloat(amount),
        userEmail || `user${userId}@nelo.app`,
        userPhone || "2348000000000"
      );
    } else {
      // Generate multi-token link (USDC/USDT)
      result = await MultiTokenOnRampService.generateMultiTokenPaymentLink(
        userId,
        token.toUpperCase() as any,
        parseFloat(amount),
        userEmail || `user${userId}@nelo.app`,
        userPhone || "2348000000000"
      );
    }

    if (result.success) {
      return res.status(200).json({
        success: true,
        data: {
          paymentUrl: result.paymentUrl,
          txRef: result.txRef,
          tokenInfo: (result as any).tokenInfo,
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error("Payment generation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate payment link",
    });
  }
});

/**
 * Get supported tokens and rates
 */
router.get("/tokens", async (req: Request, res: Response) => {
  try {
    const tokens = MultiTokenOnRampService.getSupportedTokens();
    const rates = await MultiTokenOnRampService.getExchangeRates();

    res.status(200).json({
      success: true,
      data: {
        supportedTokens: tokens,
        exchangeRates: rates,
      },
    });
  } catch (error) {
    logger.error("Error getting supported tokens:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get supported tokens",
    });
  }
});

export default router;
