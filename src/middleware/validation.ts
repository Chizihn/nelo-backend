import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { logger } from "@/utils/logger";

/**
 * Middleware to validate request using express-validator
 */
export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    logger.warn("Validation errors:", errors.array());

    res.status(400).json({
      success: false,
      error: "Validation failed",
      details: errors.array(),
    });
    return;
  }

  next();
};

/**
 * Middleware to validate WhatsApp number format
 */
export const validateWhatsAppNumber = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { whatsappNumber } = req.body;

  if (!whatsappNumber) {
    res.status(400).json({
      success: false,
      error: "WhatsApp number is required",
    });
    return;
  }

  // Basic WhatsApp number validation
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(whatsappNumber)) {
    res.status(400).json({
      success: false,
      error: "Invalid WhatsApp number format",
    });
    return;
  }

  next();
};

/**
 * Middleware to validate Ethereum address
 */
export const validateEthereumAddress = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { address } = req.body;

  if (!address) {
    res.status(400).json({
      success: false,
      error: "Address is required",
    });
    return;
  }

  // Basic Ethereum address validation
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!addressRegex.test(address)) {
    res.status(400).json({
      success: false,
      error: "Invalid Ethereum address format",
    });
    return;
  }

  next();
};

/**
 * Middleware to validate amount
 */
export const validateAmount = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { amount } = req.body;

  if (!amount) {
    res.status(400).json({
      success: false,
      error: "Amount is required",
    });
    return;
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    res.status(400).json({
      success: false,
      error: "Invalid amount",
    });
    return;
  }

  next();
};

/**
 * Middleware to validate UUID
 */
export const validateUUID = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];

    if (!value) {
      res.status(400).json({
        success: false,
        error: `${paramName} is required`,
      });
      return;
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      res.status(400).json({
        success: false,
        error: `Invalid ${paramName} format`,
      });
      return;
    }

    next();
  };
};
