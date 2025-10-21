import { Request, Response, NextFunction } from "express";
import { logger } from "@/utils/logger";
import { env } from "@/config/env";

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  logger.error("Error occurred:", {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  // Default error values
  let statusCode = error.statusCode || 500;
  let message = error.message || "Internal Server Error";
  let code = error.code || "INTERNAL_SERVER_ERROR";

  // Handle specific error types
  if (error.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error";
    code = "VALIDATION_ERROR";
  } else if (error.name === "UnauthorizedError") {
    statusCode = 401;
    message = "Unauthorized";
    code = "UNAUTHORIZED";
  } else if (error.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
    code = "INVALID_ID";
  } else if (error.code === "11000") {
    statusCode = 409;
    message = "Duplicate entry";
    code = "DUPLICATE_ENTRY";
  }

  // Prepare error response
  const errorResponse: any = {
    success: false,
    error: message,
    code,
    timestamp: new Date().toISOString(),
  };

  // Include stack trace in development
  if (env.NODE_ENV === "development") {
    errorResponse.stack = error.stack;
    errorResponse.details = error;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * Handle 404 errors
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn(`404 - Route not found: ${req.method} ${req.url}`);

  res.status(404).json({
    success: false,
    error: "Route not found",
    code: "NOT_FOUND",
    message: `Cannot ${req.method} ${req.url}`,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Async error wrapper
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create custom error
 */
export const createError = (
  message: string,
  statusCode: number = 500,
  code?: string
): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.isOperational = true;
  return error;
};
