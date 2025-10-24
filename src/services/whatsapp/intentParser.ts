import { MessageContext } from "@/types/whatsapp.types";
import { REGEX_PATTERNS } from "@/utils/constants";
import { BasenameService } from "../blockchain/basenameService";
import { logger } from "@/utils/logger";

export interface ParsedIntent {
  type: string;
  confidence: number;
  data?: any;
}

export class IntentParser {
  private patterns = {
    // Greetings - More natural
    GREETING: [
      /^(hi|hello|hey|good morning|good afternoon|good evening)/i,
      /^(start|begin|let's start|get started)/i,
      /^(yo|sup|what's up|wassup)/i,
    ],

    // Help - More conversational
    HELP: [
      /^(help|commands|menu|what can you do)/i,
      /^(how to|how do i|show me|guide me)/i,
      /^(i need help|help me|assist me|support)/i,
      /^(what|huh|confused|lost|stuck)/i,
    ],

    // Card operations - More natural
    CREATE_CARD: [
      /^(create card|new card|make card|get card)/i,
      /^(i want a card|need a card|give me a card)/i,
      /^(card please|can i get a card|make me a card)/i,
    ],

    CHECK_BALANCE: [
      /^(balance|check balance|my balance|show balance)/i,
      /^(how much|what's my balance|money|funds)/i,
      /^(portfolio|wallet|my money|my crypto)/i,
    ],

    LIST_CARDS: [/^(my cards|list cards|show cards|cards)$/i, /^(all cards)$/i],

    VIEW_CARD: [
      /^(view card|card details|show card|card info)$/i,
      /^(my card|card)$/i,
    ],

    DELETE_CARD: [
      /^(delete card|remove card|deactivate card)/i,
      /^(close card|cancel card)/i,
    ],

    FREEZE_CARD: [
      /^(freeze card|block card|disable card)/i,
      /^(pause card|stop card)/i,
    ],

    UNFREEZE_CARD: [
      /^(unfreeze card|unblock card|enable card)/i,
      /^(activate card|resume card)/i,
    ],

    WITHDRAW_FROM_CARD: [
      /^(withdraw from card|card withdraw)\s+(\d+(?:\.\d+)?)/i,
      /^(move from card|transfer from card)\s+(\d+(?:\.\d+)?)/i,
    ],

    CARD_HISTORY: [
      /^(card history|card transactions)/i,
      /^(my card activity|card activity)/i,
    ],

    // Transactions - More natural language
    SEND_MONEY: [
      /^send\s+(\d+(?:\.\d+)?)\s*(?:(cngn|usdc)\s+)?to\s+(.+)/i,
      /^transfer\s+(\d+(?:\.\d+)?)\s*(?:(cngn|usdc)\s+)?to\s+(.+)/i,
      /^pay\s+(\d+(?:\.\d+)?)\s*(?:(cngn|usdc)\s+)?to\s+(.+)/i,
      /^give\s+(\d+(?:\.\d+)?)\s*(?:(cngn|usdc)\s+)?to\s+(.+)/i,
      /^i want to send\s+(\d+(?:\.\d+)?)\s*(?:(cngn|usdc)\s+)?to\s+(.+)/i,
    ],

    DEPOSIT: [
      /^(deposit|add funds|fund|top up)/i,
      /^(how to deposit|deposit address)/i,
    ],

    BUY_CNGN: [
      /^(buy cngn|buy (\d+(?:\.\d+)?)\s*cngn)/i,
      /^(buy naira|add naira)/i,
    ],

    BUY_USDC: [
      /^(buy usdc|buy (\d+(?:\.\d+)?)\s*usdc)/i,
      /^(buy usd|add usd)/i,
    ],

    // Bridge operations
    BRIDGE: [
      /^bridge\s+(\d+(?:\.\d+)?)\s+(cngn|usdc)\s+to\s+(cngn|usdc)/i,
      /^swap\s+(\d+(?:\.\d+)?)\s+(cngn|usdc)\s+for\s+(cngn|usdc)/i,
      /^convert\s+(\d+(?:\.\d+)?)\s+(cngn|usdc)\s+to\s+(cngn|usdc)/i,
    ],

    // USDT removed - focusing only on cNGN and USDC

    BUY_AMOUNT: [/^buy\s+(\d+(?:\.\d+)?)$/i],

    BUY_CRYPTO: [/^(buy crypto|add money|fund wallet)$/i],

    WITHDRAW: [
      /^(withdraw|cash out|off ramp|offramp)/i,
      /^(sell cngn|convert to naira)/i,
      /^(withdraw (\d+(?:\.\d+)?)\s*(?:cngn|naira)?)/i,
    ],

    BANK_ACCOUNT: [
      /^(add bank|bank account|set bank)/i,
      /^(bank details|my bank|my banks)/i,
    ],

    // History
    TRANSACTION_HISTORY: [
      /^(history|transactions|recent|activity)/i,
      /^(show history|my transactions)/i,
    ],

    // Profile
    PROFILE: [/^(profile|my info|account|me)/i, /^(show profile|my account)/i],

    // Basename operations
    SET_BASENAME: [
      /^set basename\s+(.+)/i,
      /^basename\s+(.+)/i,
      /^my basename is\s+(.+)/i,
    ],

    CHECK_BASENAME: [
      /^check basename\s+(.+)/i,
      /^is\s+(.+)\s+available/i,
      /^basename available\s+(.+)/i,
    ],

    // KYC and verification
    SUBMIT_KYC: [
      /^(submit kyc|kyc|verify id|verify|identity)/i,
      /^(my name is|i am)\s+(.+)/i,
      /^(verify me|check identity)/i,
    ],

    // Bank operations
    ADD_BANK: [
      /^(add bank|my bank is)\s+(.+)/i,
      /^(bank)\s+(.+)/i,
      /^(set bank|update bank)\s+(.+)/i,
    ],

    // Fiat operations
    CASH_OUT: [
      /^(cash out|cashout)\s+(\d+(?:\.\d+)?)/i,
      /^(withdraw to bank|bank withdraw)\s+(\d+(?:\.\d+)?)/i,
    ],

    BUY_WITH_BANK: [
      /^(buy)\s+(\d+(?:\.\d+)?)/i,
      /^(purchase)\s+(\d+(?:\.\d+)?)/i,
      /^(fund)\s+(\d+(?:\.\d+)?)/i,
    ],

    CONFIRM_PAYMENT: [
      /^(paid|payment done|transferred)\s+(\d+(?:\.\d+)?)/i,
      /^(sent|completed)\s+(\d+(?:\.\d+)?)/i,
      /^(done)\s+(\d+(?:\.\d+)?)/i,
    ],

    // Security and PIN
    SETUP_PIN: [
      /^(setup pin|set pin|create pin)/i,
      /^(pin setup|configure pin)/i,
    ],

    RESET_PIN: [/^(reset pin|change pin|forgot pin)/i, /^(pin reset|new pin)/i],

    // Bridge operations
    BRIDGE_TOKENS: [
      /^(bridge|swap)\s+(\d+(?:\.\d+)?)\s+(cngn|usdc)\s+to\s+(cngn|usdc)/i,
      /^(convert)\s+(\d+(?:\.\d+)?)\s+(cngn|usdc)\s+to\s+(cngn|usdc)/i,
    ],

    // General
    CANCEL: [/^(cancel|stop|abort|exit|back)/i, /^(no|nope|nevermind)/i],
  };

  /**
   * Parse user message to determine intent
   */
  async parseIntent(
    message: string,
    context: MessageContext
  ): Promise<ParsedIntent> {
    try {
      const cleanMessage = message.trim().toLowerCase();

      // Check each intent pattern
      for (const [intentType, patterns] of Object.entries(this.patterns)) {
        for (const pattern of patterns) {
          const match = cleanMessage.match(pattern);

          if (match) {
            const intent: ParsedIntent = {
              type: intentType,
              confidence: 0.9,
            };

            // Extract data for specific intents
            if (intentType === "SEND_MONEY" && match.length >= 3) {
              const amount = match[1];
              const token = match[2] || "cngn"; // Default to cngn
              const recipient = match[3] ? match[3].trim() : match[2].trim();

              // Validate amount
              if (!REGEX_PATTERNS.AMOUNT.test(amount)) {
                return {
                  type: "ERROR",
                  confidence: 1.0,
                  data: { message: "Invalid amount format" },
                };
              }

              // Process recipient (could be address or basename)
              const processedRecipient = await this.processRecipient(recipient);

              intent.data = {
                amount: `${amount} ${token}`,
                recipient: processedRecipient.address || recipient,
                recipientType: processedRecipient.type,
                originalRecipient: recipient,
                token: token.toLowerCase(),
              };
            }

            // Handle basename operations
            if (
              (intentType === "SET_BASENAME" ||
                intentType === "CHECK_BASENAME") &&
              match.length >= 2
            ) {
              const basename = match[1].trim();
              intent.data = { basename };
            }

            // Handle buy cNGN with amount
            if (intentType === "BUY_CNGN" && match.length >= 3) {
              const amount = match[2];
              if (REGEX_PATTERNS.AMOUNT.test(amount)) {
                intent.data = { amount };
              }
            }

            // Handle buy USDC with amount
            if (intentType === "BUY_USDC" && match.length >= 3) {
              const amount = match[2];
              if (REGEX_PATTERNS.AMOUNT.test(amount)) {
                intent.data = { amount };
              }
            }

            // Handle bridge tokens
            if (intentType === "BRIDGE_TOKENS" && match.length >= 5) {
              const amount = match[2];
              const fromToken = match[3];
              const toToken = match[4];

              if (REGEX_PATTERNS.AMOUNT.test(amount)) {
                intent.data = {
                  amount,
                  fromToken: fromToken.toLowerCase(),
                  toToken: toToken.toLowerCase(),
                };
              }
            }

            // Handle bridge operations
            if (intentType === "BRIDGE" && match.length >= 4) {
              const amount = match[1];
              const fromToken = match[2].toUpperCase();
              const toToken = match[3].toUpperCase();

              if (REGEX_PATTERNS.AMOUNT.test(amount)) {
                intent.data = {
                  amount,
                  fromToken,
                  toToken,
                };
              }
            }

            // Handle withdraw with amount
            if (intentType === "WITHDRAW" && match.length >= 3) {
              const amount = match[2];
              if (REGEX_PATTERNS.AMOUNT.test(amount)) {
                intent.data = { amount };
              }
            }

            // Handle KYC verification
            if (intentType === "SUBMIT_KYC" && match.length >= 2) {
              const nameMatch = match[0].match(
                /(?:my name is|i am)\s+([a-z\s]+?)(?:\s*,?\s*id\s*(\w+))?$/i
              );
              if (nameMatch) {
                const fullName = nameMatch[1].trim();
                const nameParts = fullName.split(/\s+/);
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(" ") || firstName;
                const idNumber = nameMatch[2];

                intent.data = {
                  firstName,
                  lastName,
                  idNumber,
                };
              }
            }

            // Handle buy USDC with amount (commented out)
            // if (intentType === "BUY_USDC" && match.length >= 3) {
            //   const amount = match[2];
            //   if (REGEX_PATTERNS.AMOUNT.test(amount)) {
            //     intent.data = { amount };
            //   }
            // }

            // USDT handling removed

            // Handle buy amount (default to cNGN)
            if (intentType === "BUY_AMOUNT" && match.length >= 2) {
              const amount = match[1];
              if (REGEX_PATTERNS.AMOUNT.test(amount)) {
                intent.data = { amount };
              }
            }

            // Handle add bank
            if (intentType === "ADD_BANK" && match.length >= 2) {
              const bankInfo = cleanMessage;
              const bankMatch = bankInfo.match(
                /(?:add bank|my bank is|bank)\s+([^,]+),?\s*account\s+(\d+),?\s*(.+)/i
              );
              if (bankMatch) {
                intent.data = {
                  bankName: bankMatch[1].trim(),
                  accountNumber: bankMatch[2].trim(),
                  accountName: bankMatch[3].trim(),
                };
              }
            }

            // Handle cash out
            if (intentType === "CASH_OUT" && match.length >= 3) {
              const amount = match[2];
              if (REGEX_PATTERNS.AMOUNT.test(amount)) {
                intent.data = { amount };
              }
            }

            // Handle buy with bank
            if (intentType === "BUY_WITH_BANK" && match.length >= 3) {
              const amount = match[2];
              if (REGEX_PATTERNS.AMOUNT.test(amount)) {
                intent.data = { amount };
              }
            }

            // Handle payment confirmation
            if (intentType === "CONFIRM_PAYMENT" && match.length >= 3) {
              const amount = match[2];
              if (REGEX_PATTERNS.AMOUNT.test(amount)) {
                intent.data = { amount };
              }
            }

            // Handle card withdrawal with amount
            if (intentType === "WITHDRAW_FROM_CARD" && match.length >= 3) {
              const amount = match[2];
              if (REGEX_PATTERNS.AMOUNT.test(amount)) {
                intent.data = { amount };
              }
            }

            return intent;
          }
        }
      }

      // If no pattern matches, try to extract common entities
      return this.fallbackParsing(cleanMessage);
    } catch (error) {
      logger.error("Error parsing intent:", error);
      return {
        type: "ERROR",
        confidence: 0.5,
        data: { message: "Failed to parse message" },
      };
    }
  }

  /**
   * Process recipient (address or basename)
   */
  private async processRecipient(recipient: string): Promise<{
    address?: string;
    type: "address" | "basename" | "unknown";
  }> {
    try {
      // Check if it's an Ethereum address
      if (REGEX_PATTERNS.ETHEREUM_ADDRESS.test(recipient)) {
        return {
          address: recipient,
          type: "address",
        };
      }

      // Check if it's a basename
      if (REGEX_PATTERNS.BASENAME.test(recipient) || recipient.includes(".")) {
        const basename = BasenameService.formatBasename(recipient);
        const resolved = await BasenameService.resolveBasename(basename);

        if (resolved.isValid) {
          return {
            address: resolved.address,
            type: "basename",
          };
        }
      }

      return { type: "unknown" };
    } catch (error) {
      logger.error("Error processing recipient:", error);
      return { type: "unknown" };
    }
  }

  /**
   * Fallback parsing for unmatched messages
   */
  private fallbackParsing(message: string): ParsedIntent {
    // Check for numbers (might be balance check)
    if (/^\d+$/.test(message)) {
      return {
        type: "CHECK_BALANCE",
        confidence: 0.3,
      };
    }

    // Check for common keywords
    if (message.includes("card")) {
      return {
        type: "LIST_CARDS",
        confidence: 0.4,
      };
    }

    if (
      message.includes("money") ||
      message.includes("send") ||
      message.includes("pay")
    ) {
      return {
        type: "HELP",
        confidence: 0.3,
        data: { context: "payment" },
      };
    }

    if (message.includes("balance")) {
      return {
        type: "CHECK_BALANCE",
        confidence: 0.6,
      };
    }

    // Default to unknown
    return {
      type: "UNKNOWN",
      confidence: 0.1,
    };
  }

  /**
   * Extract amount from message
   */
  private extractAmount(message: string): string | null {
    const amountMatch = message.match(/(\d+(?:\.\d+)?)/);
    return amountMatch ? amountMatch[1] : null;
  }

  /**
   * Extract address or basename from message
   */
  private extractRecipient(message: string): string | null {
    // Look for Ethereum address
    const addressMatch = message.match(REGEX_PATTERNS.ETHEREUM_ADDRESS);
    if (addressMatch) {
      return addressMatch[0];
    }

    // Look for basename
    const basenameMatch = message.match(/([a-z0-9-]+\.basetest\.eth)/i);
    if (basenameMatch) {
      return basenameMatch[1];
    }

    // Look for "to [recipient]" pattern
    const toMatch = message.match(/to\s+([^\s]+)/i);
    if (toMatch) {
      return toMatch[1];
    }

    return null;
  }

  /**
   * Get intent suggestions based on partial message
   */
  getSuggestions(partialMessage: string): string[] {
    const suggestions: string[] = [];
    const message = partialMessage.toLowerCase();

    if (message.includes("send") || message.includes("pay")) {
      suggestions.push("send 100 to alice.basetest.eth");
      suggestions.push("send 50 to 0x1234...");
    }

    if (message.includes("card")) {
      suggestions.push("create card");
      suggestions.push("my cards");
      suggestions.push("check balance");
    }

    if (message.includes("balance")) {
      suggestions.push("check balance");
      suggestions.push("my cards");
    }

    if (suggestions.length === 0) {
      suggestions.push("help", "create card", "check balance", "my cards");
    }

    return suggestions.slice(0, 4);
  }
}
