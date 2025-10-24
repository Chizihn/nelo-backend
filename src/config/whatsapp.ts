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

// Updated Message templates with better UX
export const MESSAGE_TEMPLATES = {
  WELCOME: `🎉 *Welcome to Nelo!*

Your Web3 financial assistant for Nigeria 🇳🇬

I help you manage virtual cards and crypto through WhatsApp - no app needed!

*🚀 Quick Start (2 minutes):*
1. Submit KYC: "submit kyc"
2. Set security PIN: "setup pin"  
3. Create virtual card: "create card"
4. Buy crypto: "buy cngn"

*💡 New to crypto?*
Perfect! I'll guide you step by step.

Type "submit kyc" to begin! ✨`,

  PERSONALIZED_WELCOME: (name: string) => `🎉 *Hey ${name}! Welcome to Nelo!*

Your personal Web3 financial assistant 🇳🇬

I help you manage virtual cards and crypto - all through WhatsApp!

*🚀 Let's get you started (2 minutes):*
1. Submit KYC: "submit kyc"
2. Set security PIN: "setup pin"
3. Create virtual card: "create card"
4. Start using crypto: "buy cngn"

*💡 First time with crypto?*
Perfect! I'll make it super easy.

Ready? Type "submit kyc" to begin! ✨`,

  HELP: `🤖 *Nelo - Your Web3 Money Assistant*

*💰 Buy & Manage Crypto:*
• buy cngn - Buy Nigerian Naira (cNGN)
• buy usdc - Buy USD Coin
• balance - Check your portfolio

*💳 Cards & Payments:*
• my cards - View your cards
• view card - See card details
• send 1000 to alice.base.eth

*🏦 Banking:*
• add bank - Link Nigerian bank
• withdraw 5000 - Cash out to bank

*📊 Account:*
• history - View transactions
• profile - Your account info

*🏷️ Basename:*
• set basename alice.base.eth
• check basename alice.base.eth

Need help with anything specific? 💬`,

  BALANCE_INFO: (balances: any) => {
    let message = `💰 *Your Portfolio*\n\n`;

    if (balances.cngn > 0) {
      message += `🇳🇬 cNGN: ${balances.cngn} (₦${balances.cngn})\n`;
    }
    if (balances.usdc > 0) {
      message += `💵 USDC: ${balances.usdc} ($${balances.usdc})\n`;
    }
    if (balances.usdt > 0) {
      message += `💰 USDT: ${balances.usdt} ($${balances.usdt})\n`;
    }

    if (balances.cngn === 0 && balances.usdc === 0 && balances.usdt === 0) {
      message += `No crypto yet. Start with:\n• "buy cngn" for Nigerian Naira\n• "buy usdc" for US Dollar\n• "buy usdt" for Tether`;
    } else {
      message += `\n💳 Active Cards: ${balances.cardCount}\n\nType "my cards" to see card balances.`;
    }

    return message;
  },

  CARD_CREATED: (cardNumber: string, address: string) =>
    `✅ *Virtual Card Created!*

🎴 Card: ****${cardNumber.slice(-4)}
💳 Wallet: ${address.slice(0, 6)}...${address.slice(-4)}
💰 Balance: 0 (empty)

*Next Steps:*
• Fund card: "buy cngn"
• Check balance: "balance"
• Send money: "send [amount] to [address]"

Your card is ready! 🚀`,

  TRANSACTION_SUCCESS: (
    amount: string,
    token: string,
    recipient: string,
    txHash: string
  ) =>
    `✅ *Transfer Successful!*

💸 Sent: ${amount} ${token.toUpperCase()}
📍 To: ${recipient.slice(0, 10)}...
🔗 TX: ${txHash.slice(0, 10)}...

View on Base: https://sepolia.basescan.org/tx/${txHash}

Type "balance" to check updated balance.`,

  ERROR_GENERIC: `❌ Something went wrong. Please try again or type "help" for assistance.`,

  ERROR_INSUFFICIENT_BALANCE: (token: string) =>
    `❌ Insufficient ${token.toUpperCase()} balance. Buy more with "buy ${token.toLowerCase()}"`,

  ERROR_INVALID_COMMAND: `❓ I didn't understand that. Type "help" to see all commands.`,

  KYC_COMPLETE: (
    firstName: string,
    lastName: string
  ) => `🎉 *KYC Submitted Successfully!*

✅ Name: ${firstName} ${lastName}
✅ Status: Verified
✅ Level: Basic

*Your new limits:*
💰 Daily: ₦100,000
📅 Monthly: ₦1,000,000
💳 Cards: 3 cards

*Next Steps:*
• Set security PIN: "setup pin"
• Create virtual card: "create card"
• Buy crypto: "buy cngn"

Welcome to Nelo! 🚀`,

  PIN_SETUP_COMPLETE: `🎉 *Security PIN Set Successfully!*

✅ Your account is now secure
✅ PIN required for all transactions
✅ Security question configured

*You can now:*
• Create virtual cards: "create card"
• Buy crypto: "buy cngn"
• Send money: "send [amount] to [address]"

Type "create card" to get started! 🚀`,
} as const;
