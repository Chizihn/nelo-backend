export const CONSTANTS = {
  // Session expiry (24 hours)
  SESSION_EXPIRY_HOURS: 24,

  // Card number generation
  CARD_NUMBER_LENGTH: 16,
  CARD_NUMBER_PREFIX: "4532", // Virtual card prefix

  // Transaction limits (in cNGN, 6 decimals)
  MAX_TRANSACTION_AMOUNT: "1000000000000", // 1M cNGN (1M * 10^6)
  MIN_TRANSACTION_AMOUNT: "1000000", // 1 cNGN (1 * 10^6)

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,

  // WhatsApp message limits
  WHATSAPP_MESSAGE_MAX_LENGTH: 4096,

  // Blockchain
  CNGN_DECIMALS: 6, // cNGN uses 6 decimals, not 18!
  CONFIRMATION_BLOCKS: 3,

  // Queue settings
  QUEUE_RETRY_ATTEMPTS: 3,
  QUEUE_RETRY_DELAY: 5000, // 5 seconds

  // Webhook verification
  WEBHOOK_TIMEOUT_MS: 30000, // 30 seconds
} as const;

// Revenue Model: Fee Structure
export const FEE_STRUCTURE = {
  // Transaction fees (in basis points: 50 = 0.5%)
  DOMESTIC_TRANSFER: 50, // 0.5% for domestic transfers
  INTERNATIONAL_TRANSFER: 100, // 1.0% for international transfers
  INSTANT_TRANSFER: 75, // 0.75% for priority processing

  // Minimum and maximum fees (in cNGN with 6 decimals)
  MIN_TRANSFER_FEE: 10_000000, // ₦10 minimum fee
  MAX_TRANSFER_FEE: 500_000000, // ₦500 maximum fee

  // Card fees (in cNGN with 6 decimals)
  CARD_CREATION_FEE: 500_000000, // ₦500 one-time card creation
  CARD_MONTHLY_FEE: 200_000000, // ₦200 monthly maintenance
  CARD_PREMIUM_FEE: 1000_000000, // ₦1,000 premium card monthly
  CARD_REPLACEMENT_FEE: 300_000000, // ₦300 for replacement

  // Conversion fees (in basis points)
  NGN_TO_CNGN_FEE: 80, // 0.8% NGN to cNGN conversion
  CNGN_TO_NGN_FEE: 80, // 0.8% cNGN to NGN conversion
  CURRENCY_EXCHANGE_FEE: 120, // 1.2% for other currencies

  // Merchant fees (in basis points)
  MERCHANT_PROCESSING_FEE: 150, // 1.5% merchant payment processing
  QR_PAYMENT_FEE: 100, // 1.0% QR code payments
  API_INTEGRATION_FEE: 80, // 0.8% API transactions

  // Premium subscription fees (monthly, in cNGN with 6 decimals)
  BUSINESS_ACCOUNT_FEE: 5000_000000, // ₦5,000/month business account
  DEVELOPER_API_FEE: 15000_000000, // ₦15,000/month API access
  WHITE_LABEL_FEE: 50000_000000, // ₦50,000/month white-label
} as const;

export const REGEX_PATTERNS = {
  WHATSAPP_NUMBER: /^\+?[1-9]\d{1,14}$/,
  ETHEREUM_ADDRESS: /^0x[a-fA-F0-9]{40}$/,
  BASENAME: /^[a-z0-9-]+\.basetest\.eth$/,
  CARD_NUMBER: /^\d{16}$/,
  AMOUNT: /^\d+(\.\d{1,8})?$/,
} as const;

export const ERROR_CODES = {
  // User errors
  USER_NOT_FOUND: "USER_NOT_FOUND",
  USER_ALREADY_EXISTS: "USER_ALREADY_EXISTS",
  INVALID_WHATSAPP_NUMBER: "INVALID_WHATSAPP_NUMBER",

  // Card errors
  CARD_NOT_FOUND: "CARD_NOT_FOUND",
  CARD_CREATION_FAILED: "CARD_CREATION_FAILED",
  CARD_SUSPENDED: "CARD_SUSPENDED",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",

  // Transaction errors
  TRANSACTION_FAILED: "TRANSACTION_FAILED",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  INVALID_RECIPIENT: "INVALID_RECIPIENT",

  // Blockchain errors
  BLOCKCHAIN_ERROR: "BLOCKCHAIN_ERROR",
  CONTRACT_INTERACTION_FAILED: "CONTRACT_INTERACTION_FAILED",
  INSUFFICIENT_GAS: "INSUFFICIENT_GAS",

  // WhatsApp errors
  WHATSAPP_API_ERROR: "WHATSAPP_API_ERROR",
  MESSAGE_SEND_FAILED: "MESSAGE_SEND_FAILED",
  WEBHOOK_VERIFICATION_FAILED: "WEBHOOK_VERIFICATION_FAILED",

  // Sudo Africa errors
  SUDO_AFRICA_API_ERROR: "SUDO_AFRICA_API_ERROR",
  SUDO_AFRICA_CUSTOMER_CREATION_FAILED: "SUDO_AFRICA_CUSTOMER_CREATION_FAILED",
  SUDO_AFRICA_CARD_CREATION_FAILED: "SUDO_AFRICA_CARD_CREATION_FAILED",
  SUDO_AFRICA_CARD_FUNDING_FAILED: "SUDO_AFRICA_CARD_FUNDING_FAILED",
  SUDO_AFRICA_TRANSACTION_FAILED: "SUDO_AFRICA_TRANSACTION_FAILED",
  SUDO_AFRICA_WEBHOOK_VERIFICATION_FAILED:
    "SUDO_AFRICA_WEBHOOK_VERIFICATION_FAILED",

  // General errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
} as const;
