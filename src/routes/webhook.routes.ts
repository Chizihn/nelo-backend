import { Router } from "express";
import { WebhookController } from "@/controllers/webhookController";
import { body } from "express-validator";
import { validateRequest } from "@/middleware/validation";

const router = Router();
const webhookController = new WebhookController();

/**
 * GET /webhook/whatsapp - Webhook verification
 */
router.get("/whatsapp", webhookController.verifyWebhook);

/**
 * POST /webhook/whatsapp - Handle incoming messages
 */
router.post(
  "/whatsapp",
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
