//src/config/whatsapp.ts
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
  WELCOME: `🎉 *Welcome to Nelo!*

Your Web3 financial assistant for Nigeria 🇳🇬

I help you manage virtual cards and cNGN on Base blockchain through WhatsApp - no app needed!

*🚀 Quick Start:*
1. Verify your identity: "verify id"
2. Set up security PIN: "setup pin"  
3. Create your card: "create card"
4. Buy cNGN: "buy 10000"

*💡 New to crypto?*
Don't worry! I'll guide you step by step.

Type "verify id" to begin! ✨`,

  PERSONALIZED_WELCOME: (name: string) => `🎉 *Hey ${name}! Welcome to Nelo!*

Your personal Web3 financial assistant 🇳🇬

I help you manage virtual cards and cNGN on Base blockchain - all through WhatsApp!

*🚀 Let's get you started:*
1. Verify your identity: "verify id"
2. Set up security PIN: "setup pin"
3. Create your card: "create card"
4. Start using crypto: "buy cngn"

*💡 First time with crypto?*
Perfect! I'll make it super easy.

Ready? Type "verify id" to begin! ✨`,

  HELP: `🤖 *Nelo - Your Web3 Money Assistant*

🆔 *Getting Started:*
• verify id - Complete identity verification
• create card - Get your virtual card

💳 *Card & Balance:*
• balance - Check your cNGN balance
• my cards - View all your cards

💰 *Buy & Sell cNGN:*
• buy 10000 - Buy cNGN with bank transfer
• paid 10000 - Confirm your payment
• cash out 5000 - Withdraw to your bank

🏦 *Banking:*
• add bank GTB 0123456789 John Doe
• my banks - View saved accounts

💸 *Send Money:*
• send 1000 to alice.base.eth
• send 500 to 0x1234...

📊 *History & Profile:*
• history - Recent transactions
• profile - Your account info

*New to crypto?* Start with "verify id" then "create card"! 🚀`,

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
