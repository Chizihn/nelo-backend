// Clean, contextual message templates
export const CLEAN_TEMPLATES = {
  // Onboarding Messages
  WELCOME_NEW: `🎉 *Welcome to Nelo!*

Your crypto wallet for Nigeria 🇳🇬

*Quick setup (2 mins):*
1. "submit kyc" - Verify identity
2. "setup pin" - Secure account  
3. "create card" - Get virtual card

Ready? Type "submit kyc" ✨`,

  WELCOME_KYC_DONE: `✅ *KYC Complete!*

Next: Set up security PIN

Type "setup pin" 🔒`,

  WELCOME_PIN_DONE: `🔒 *Account Secured!*

Ready to create your card?

Type "create card" 💳`,

  WELCOME_READY: `🚀 *You're all set!*

*Quick actions:*
• "balance" - Check funds
• "buy 10000" - Add ₦10K cNGN  
• "my cards" - View cards

Need help? Type "help"`,

  // Transaction Messages
  BUY_CNGN_SUCCESS: (
    amount: number,
    reference: string,
    account: string
  ) => `💰 *Buy ${amount.toLocaleString()} cNGN*

Transfer ₦${amount.toLocaleString()} to:
🏦 ${account}
📋 Ref: ${reference}

After transfer: "paid ${amount}"`,

  PAYMENT_CONFIRMED: (
    amount: number,
    txHash: string
  ) => `✅ *Payment Confirmed!*

Received: ${amount.toLocaleString()} cNGN
TX: ${txHash.slice(0, 8)}...

Type "balance" to check 💰`,

  // Balance Messages
  BALANCE_EMPTY: `💰 *Your Balance*

cNGN: 0 ₦
Cards: 0

Get started: "buy 10000" 🚀`,

  BALANCE_WITH_FUNDS: (cngn: number, cards: number) => `💰 *Your Balance*

cNGN: ${cngn.toLocaleString()} ₦
Cards: ${cards}

Actions: "my cards" | "buy cngn" | "send"`,

  // Card Messages
  CARD_CREATED: (cardLast4: string) => `🎉 *Card Created!*

Card: ****${cardLast4}
Balance: 0 cNGN

Fund it: "buy 10000" 💰`,

  CARD_SELECTION: (cards: any[]) => {
    let msg = `💳 *Select Card*\n\n`;
    cards.forEach((card, i) => {
      msg += `${i + 1}. ****${card.cardNumber.slice(-4)} (${
        card.cNGNBalance
      } cNGN)\n`;
    });
    msg += `\nReply with number (1-${cards.length})`;
    return msg;
  },

  CARD_DETAILS: (card: any) => `💳 *Card Details*

Number: ${card.cardNumber}
Expiry: ${card.metadata?.expiryMonth || "12"}/${
    card.metadata?.expiryYear || "28"
  }
CVV: ${card.metadata?.cvv || "123"}
Balance: ${card.cNGNBalance} cNGN

⚠️ Keep details private`,

  // Error Messages
  ERROR_SIMPLE: `❌ Something went wrong. Try again or type "help"`,

  ERROR_KYC_REQUIRED: `🔒 Complete KYC first: "submit kyc"`,

  ERROR_PIN_REQUIRED: `🔐 Set up PIN first: "setup pin"`,

  // Help Messages
  HELP_CONTEXTUAL: (userState: string) => {
    switch (userState) {
      case "new":
        return `*Getting Started:*
• "submit kyc" - Verify identity
• "help" - Show this menu`;

      case "kyc_done":
        return `*Next Steps:*
• "setup pin" - Secure account
• "profile" - View info`;

      case "pin_done":
        return `*Create Card:*
• "create card" - Get virtual card
• "balance" - Check funds`;

      case "ready":
        return `*Main Menu:*
• "balance" - Check funds
• "buy 10000" - Add cNGN
• "my cards" - View cards
• "send 1000 to alice.base.eth"
• "profile" - Account info`;

      default:
        return `*Available Commands:*
• "balance" - Check funds
• "buy cngn" - Add money
• "help" - Show menu`;
    }
  },
};
