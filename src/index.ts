import express from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { CONSTANTS } from "./utils/constants";

// Import routes
import webhookRoutes from "./routes/webhook.routes";
import cardRoutes from "./routes/card.routes";
import userRoutes from "./routes/user.routes";
import transactionRoutes from "./routes/transaction.routes";
import paymentRoutes from "./routes/payment.routes";
import adminRoutes from "./routes/admin.routes";
import { env } from "./config/env";
import logger from "./utils/logger";

// Create Express app
const app = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

// CORS configuration
app.use(
  cors({
    origin:
      env.NODE_ENV === "production"
        ? ["https://your-frontend-domain.com"]
        : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  })
);

// Rate limiting
// const limiter = rateLimit({
//   windowMs: CONSTANTS.RATE_LIMIT_WINDOW_MS,
//   max: CONSTANTS.RATE_LIMIT_MAX_REQUESTS,
//   message: {
//     success: false,
//     error: "Too many requests",
//     code: "RATE_LIMIT_EXCEEDED",
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// app.use(limiter);

// Body parsing middleware with security limits
app.use(express.json({ limit: "10kb" })); // Reduced for security
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Request logging
app.use((req, res, next) => {
  // logger.info(`${req.method} ${req.url}`, {
  //   ip: req.ip,
  //   userAgent: req.get("User-Agent"),
  // });

  // Special logging for webhook requests
  if (req.url.includes("/webhook/whatsapp")) {
    // logger.info("🔔 WEBHOOK REQUEST DETECTED!", {
    //   method: req.method,
    //   url: req.url,
    //   headers: req.headers,
    //   body: req.body,
    // });
  }

  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: env.NODE_ENV,
  });
});

// API routes
app.use("/webhook", webhookRoutes);
app.use("/api/cards", cardRoutes);
app.use("/api/users", userRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/admin", adminRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Nelo Backend API",
    version: "1.0.0",
    documentation: "/api/docs",
    health: "/health",
    webhook: "/webhook/whatsapp",
  });
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
const PORT = env.PORT || 3000;

const server = app.listen(PORT, () => {
  // logger.info(`🚀 Server running on port ${PORT}`);
  // logger.info(`📱 Environment: ${env.NODE_ENV}`);
  // logger.info(`🔗 Webhook URL: http://localhost:${PORT}/webhook/whatsapp`);
  // logger.info(`💳 Virtual Card Backend is ready!`);

  // Start message worker for periodic user engagement
  if (env.NODE_ENV === "production") {
    const { messageWorker } = require("./services/worker/messageWorker");
    messageWorker.start();
  }
});

// Graceful shutdown
process.on("SIGTERM", () => {
  // logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    // logger.info("Process terminated");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  // logger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    // logger.info("Process terminated");
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  // logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

export default app;
