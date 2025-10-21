import { env } from "./env";

export const WHATSAPP_CONFIG = {
  accessToken: env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
  webhookVerifyToken: env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  appSecret: env.WHATSAPP_APP_SECRET,
  apiVersion: "v18.0",
  baseUrl: "https://graph.facebook.com",
} as const;

export const WHATSAPP_ENDPOINTS = {
  messages: `${WHATSAPP_CONFIG.baseUrl}/${WHATSAPP_CONFIG.apiVersion}/${WHATSAPP_CONFIG.phoneNumberId}/messages`,
  media: `${WHATSAPP_CONFIG.baseUrl}/${WHATSAPP_CONFIG.apiVersion}/${WHATSAPP_CONFIG.phoneNumberId}/media`,
} as const;

// Message templates
export const MESSAGE_TEMPLATES = {
  WELCOME: `🎉 Welcome to Nelo Virtual Cards!

I'm your Web3 assistant for managing virtual cards on Base blockchain with cNGN.

Available commands:
• *create card* - Create a new virtual card
• *balance* - Check your card balance
• *my cards* - View all your cards
• *send [amount] to [address/basename]* - Send cNGN
• *deposit* - Get deposit link
• *history* - View transactions
• *help* - Show this menu

Let's get started! 🚀`,

  PERSONALIZED_WELCOME: (
    name: string
  ) => `🎉 Hey ${name}! Welcome to Nelo Virtual Cards!

I'm your Web3 assistant for managing virtual cards on Base blockchain with cNGN.

Available commands:
• *create card* - Create a new virtual card
• *balance* - Check your card balance
• *my cards* - View all your cards
• *send [amount] to [address/basename]* - Send cNGN
• *deposit* - Get deposit link
• *history* - View transactions
• *help* - Show this menu

Let's get started! 🚀`,

  HELP: `🤖 *Nelo Bot Commands*

💳 *Card Management:*
• create card / new card
• balance / check balance
• my cards / list cards

💰 *Money Operations:*
• send [amount] to [address/basename]
• buy [amount] / buy cngn
• withdraw [amount] / cash out
• deposit / add funds

🏦 *Banking:*
• bank account / add bank
• history / transactions

👤 *Profile & Settings:*
• profile / my info
• set basename [name]
• help / commands

*Examples:*
• "send 5000 to mama.basetest.eth"
• "buy 50000" (buy cNGN with NGN)
• "withdraw 25000" (cash out to bank)`,

  CARD_CREATED: (cardNumber: string, address: string) =>
    `✅ *Card Created Successfully!*

🎴 Card Number: \`${cardNumber}\`
💳 Wallet: \`${address}\`
💰 Balance: 0 cNGN

Your virtual card is ready! You can now deposit cNGN and start using it.

Type *deposit* to add funds.`,

  BALANCE_INFO: (balance: string, cardCount: number) =>
    `💰 *Your Balance*

Total cNGN: *${balance}*
Active Cards: *${cardCount}*

Type *my cards* to see individual card balances.`,

  TRANSACTION_SUCCESS: (amount: string, recipient: string, txHash: string) =>
    `✅ *Transaction Successful*

💸 Sent: *${amount} cNGN*
📍 To: \`${recipient}\`
🔗 TX: \`${txHash}\`

View on Base Sepolia: https://sepolia.basescan.org/tx/${txHash}`,

  ERROR_GENERIC: `❌ Something went wrong. Please try again or contact support.`,

  ERROR_INSUFFICIENT_BALANCE: `❌ Insufficient balance. Please deposit more cNGN first.`,

  ERROR_INVALID_COMMAND: `❓ I didn't understand that command. Type *help* to see available options.`,
} as const;
