import { Router } from "express";
import { messageWorker } from "../services/worker/messageWorker";
import { logger } from "@/utils/logger";

const router = Router();

/**
 * Admin route to send broadcast messages
 * POST /admin/broadcast
 */
router.post("/broadcast", async (req, res) => {
  try {
    const { message, userLimit = 50, adminKey } = req.body;

    // Simple admin key check (in production, use proper authentication)
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message is required",
      });
    }

    // Send broadcast
    await messageWorker.sendBroadcast(message, userLimit);

    res.json({
      success: true,
      message: `Broadcast sent to up to ${userLimit} users`,
    });
  } catch (error) {
    logger.error("Error sending broadcast:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send broadcast",
    });
  }
});

/**
 * Admin route to get worker status
 * GET /admin/worker-status
 */
router.get("/worker-status", (req, res) => {
  try {
    const { adminKey } = req.query;

    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    res.json({
      success: true,
      status: "Message worker is running",
      interval: "12 hours",
      nextRun: "Automatic",
    });
  } catch (error) {
    logger.error("Error getting worker status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get status",
    });
  }
});

export default router;
