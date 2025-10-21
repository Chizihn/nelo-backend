import { Queue, Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";
import { TransactionService } from "@/services/transaction/transactionService";
import { CardService } from "@/services/card/cardService";
import { WhatsAppService } from "@/services/whatsapp/whatsappService";
import { CONSTANTS } from "@/utils/constants";

// Redis connection for BullMQ
const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// Transaction monitoring queue
export const transactionQueue = new Queue("transaction-monitoring", {
  connection: redis,
  defaultJobOptions: {
    attempts: CONSTANTS.QUEUE_RETRY_ATTEMPTS,
    backoff: {
      type: "exponential",
      delay: CONSTANTS.QUEUE_RETRY_DELAY,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// Job types
export interface TransactionMonitorJob {
  transactionId: string;
  txHash: string;
  userId: string;
  type: "CARD_CREATION" | "DEPOSIT" | "TRANSFER" | "PAYMENT";
}

export interface BalanceSyncJob {
  cardId: string;
  userId: string;
}

export interface NotificationJob {
  userId: string;
  whatsappNumber: string;
  message: string;
  type: "TRANSACTION_COMPLETE" | "TRANSACTION_FAILED" | "BALANCE_UPDATE";
}

// Transaction monitoring worker
const transactionWorker = new Worker(
  "transaction-monitoring",
  async (job: Job) => {
    const { name, data } = job;

    try {
      switch (name) {
        case "monitor-transaction":
          await handleTransactionMonitoring(data as TransactionMonitorJob);
          break;
        case "sync-balance":
          await handleBalanceSync(data as BalanceSyncJob);
          break;
        case "send-notification":
          await handleNotification(data as NotificationJob);
          break;
        default:
          logger.warn(`Unknown job type: ${name}`);
      }
    } catch (error) {
      logger.error(`Error processing job ${name}:`, error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

/**
 * Handle transaction monitoring
 */
async function handleTransactionMonitoring(
  data: TransactionMonitorJob
): Promise<void> {
  const { transactionId, txHash, userId, type } = data;

  try {
    logger.info(`Monitoring transaction: ${txHash}`);

    // Check transaction status on blockchain
    // This would involve checking the transaction receipt
    // For now, we'll simulate successful completion after a delay

    await new Promise((resolve) => setTimeout(resolve, 30000)); // Wait 30 seconds

    // Update transaction status
    await TransactionService.updateTransactionStatus(
      transactionId,
      "COMPLETED",
      txHash
    );

    // Send notification to user
    await transactionQueue.add("send-notification", {
      userId,
      whatsappNumber: "", // Would get from user record
      message: getTransactionCompleteMessage(type, txHash),
      type: "TRANSACTION_COMPLETE",
    } as NotificationJob);

    logger.info(`Transaction monitoring completed: ${txHash}`);
  } catch (error) {
    logger.error(`Transaction monitoring failed: ${txHash}`, error);

    // Update transaction as failed
    await TransactionService.updateTransactionStatus(transactionId, "FAILED");

    // Send failure notification
    await transactionQueue.add("send-notification", {
      userId,
      whatsappNumber: "",
      message: `❌ Transaction failed. Please try again or contact support.`,
      type: "TRANSACTION_FAILED",
    } as NotificationJob);

    throw error;
  }
}

/**
 * Handle balance synchronization
 */
async function handleBalanceSync(data: BalanceSyncJob): Promise<void> {
  const { cardId, userId } = data;

  try {
    logger.info(`Syncing balance for card: ${cardId}`);

    const success = await CardService.syncCardBalance(cardId);

    if (success) {
      // Send balance update notification
      await transactionQueue.add("send-notification", {
        userId,
        whatsappNumber: "",
        message: `💰 Your card balance has been updated!`,
        type: "BALANCE_UPDATE",
      } as NotificationJob);
    }

    logger.info(`Balance sync completed for card: ${cardId}`);
  } catch (error) {
    logger.error(`Balance sync failed for card: ${cardId}`, error);
    throw error;
  }
}

/**
 * Handle WhatsApp notifications
 */
async function handleNotification(data: NotificationJob): Promise<void> {
  const { whatsappNumber, message } = data;

  try {
    if (!whatsappNumber) {
      logger.warn("No WhatsApp number provided for notification");
      return;
    }

    const whatsappService = new WhatsAppService();
    const success = await whatsappService.sendMessage(whatsappNumber, message);

    if (success) {
      logger.info(`Notification sent to ${whatsappNumber}`);
    } else {
      logger.error(`Failed to send notification to ${whatsappNumber}`);
      throw new Error("Notification sending failed");
    }
  } catch (error) {
    logger.error("Notification handling failed:", error);
    throw error;
  }
}

/**
 * Get transaction complete message
 */
function getTransactionCompleteMessage(type: string, txHash: string): string {
  const baseUrl = "https://sepolia.basescan.org/tx/";

  switch (type) {
    case "CARD_CREATION":
      return `✅ *Virtual Card Created!*\n\nYour card is ready to use. You can now deposit cNGN and start making payments.\n\n🔗 View transaction: ${baseUrl}${txHash}`;

    case "DEPOSIT":
      return `✅ *Deposit Successful!*\n\nYour cNGN has been added to your card balance.\n\n🔗 View transaction: ${baseUrl}${txHash}`;

    case "TRANSFER":
      return `✅ *Transfer Complete!*\n\nYour cNGN has been sent successfully.\n\n🔗 View transaction: ${baseUrl}${txHash}`;

    case "PAYMENT":
      return `✅ *Payment Processed!*\n\nYour payment has been completed successfully.\n\n🔗 View transaction: ${baseUrl}${txHash}`;

    default:
      return `✅ *Transaction Complete!*\n\n🔗 View transaction: ${baseUrl}${txHash}`;
  }
}

/**
 * Add transaction monitoring job
 */
export async function addTransactionMonitoringJob(
  data: TransactionMonitorJob
): Promise<void> {
  await transactionQueue.add("monitor-transaction", data, {
    delay: 5000, // Start monitoring after 5 seconds
  });
}

/**
 * Add balance sync job
 */
export async function addBalanceSyncJob(data: BalanceSyncJob): Promise<void> {
  await transactionQueue.add("sync-balance", data);
}

/**
 * Add notification job
 */
export async function addNotificationJob(data: NotificationJob): Promise<void> {
  await transactionQueue.add("send-notification", data);
}

// Worker event handlers
transactionWorker.on("completed", (job) => {
  logger.info(`Job ${job.name} completed successfully`);
});

transactionWorker.on("failed", (job, err) => {
  logger.error(`Job ${job?.name} failed:`, err);
});

transactionWorker.on("error", (err) => {
  logger.error("Transaction worker error:", err);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("Shutting down transaction worker...");
  await transactionWorker.close();
  await redis.quit();
});

export { transactionWorker };
