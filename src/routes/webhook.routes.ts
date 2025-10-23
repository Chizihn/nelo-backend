import { Router } from "express";
import { WebhookController } from "@/controllers/webhookController";
import { body } from "express-validator";
import { validateRequest } from "@/middleware/validation";
import rateLimit from "express-rate-limit";

const router = Router();
const webhookController = new WebhookController();

// Rate limiter for webhook endpoints
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: "Too many webhook requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * GET /webhook/whatsapp - Webhook verification
 */
router.get("/whatsapp", webhookController.verifyWebhook);

/**
 * POST /webhook/whatsapp - Handle incoming messages
 */
router.post(
  "/whatsapp",
  webhookLimiter, // Add rate limiting
  [body("object").isString().notEmpty(), body("entry").isArray().notEmpty()],
  validateRequest,
  webhookController.handleWebhook
);

/**
 * GET /webhook/health - Health check
 */
router.get("/health", webhookController.healthCheck);

/**
 * GET /webhook/info - Webhook info
 */
router.get("/info", webhookController.getWebhookInfo);

export default router;
