import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    whatsappNumber: string;
    walletAddress: string;
  };
}

/**
 * JWT Authentication middleware
 */
export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: "Access token required",
        code: "MISSING_TOKEN",
      });
      return;
    }

    jwt.verify(token, env.JWT_SECRET, (err, decoded) => {
      if (err) {
        logger.warn("Invalid token:", err.message);
        res.status(403).json({
          success: false,
          error: "Invalid or expired token",
          code: "INVALID_TOKEN",
        });
        return;
      }

      req.user = decoded as any;
      next();
    });
  } catch (error) {
    logger.error("Error in token authentication:", error);
    res.status(500).json({
      success: false,
      error: "Authentication error",
      code: "AUTH_ERROR",
    });
  }
};

/**
 * Optional authentication middleware
 */
export const optionalAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      next();
      return;
    }

    jwt.verify(token, env.JWT_SECRET, (err, decoded) => {
      if (!err) {
        req.user = decoded as any;
      }
      next();
    });
  } catch (error) {
    logger.error("Error in optional authentication:", error);
    next();
  }
};

/**
 * Generate JWT token
 */
export const generateToken = (payload: {
  id: string;
  whatsappNumber: string;
  walletAddress: string;
}): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: "7d",
    issuer: "virtual-card-backend",
  });
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (error) {
    throw new Error("Invalid token");
  }
};

/**
 * API Key authentication middleware (for admin endpoints)
 */
export const authenticateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const apiKey = req.headers["x-api-key"] as string;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: "API key required",
        code: "MISSING_API_KEY",
      });
      return;
    }

    // In production, store API keys in database or environment
    const validApiKeys = [env.JWT_SECRET]; // Temporary - use proper API key management

    if (!validApiKeys.includes(apiKey)) {
      res.status(403).json({
        success: false,
        error: "Invalid API key",
        code: "INVALID_API_KEY",
      });
      return;
    }

    next();
  } catch (error) {
    logger.error("Error in API key authentication:", error);
    res.status(500).json({
      success: false,
      error: "Authentication error",
      code: "AUTH_ERROR",
    });
  }
};
