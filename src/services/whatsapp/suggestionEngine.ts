import { UserService } from "../user/userService";
import { CardService } from "../card/cardService";
import { PinService } from "../security/pinService";

export class SuggestionEngine {
  /**
   * Get contextual suggestions based on user state
   */
  static async getSmartSuggestions(userId: string): Promise<string[]> {
    try {
      const kycStatus = await UserService.getKYCStatus(userId);
      const hasPinSetup = await PinService.hasPinSetup(userId);
      const cardCount = await CardService.getCardCount(userId);

      // New user - needs KYC
      if (!kycStatus.verified) {
        return ["submit kyc", "help", "what is kyc"];
      }

      // KYC done, needs PIN
      if (!hasPinSetup) {
        return ["setup pin", "help", "create card"];
      }

      // KYC + PIN done, needs card
      if (cardCount === 0) {
        return ["create card", "buy cngn", "balance"];
      }

      // Fully set up user
      return ["balance", "buy cngn", "send money", "my cards", "history"];
    } catch (error) {
      return ["help", "balance", "buy cngn"];
    }
  }

  /**
   * Get suggestions for failed commands
   */
  static getSimilarCommands(input: string): string[] {
    const commands = [
      "balance",
      "buy cngn",
      "buy usdc",
      "send money",
      "create card",
      "my cards",
      "view card",
      "history",
      "profile",
      "help",
      "submit kyc",
      "setup pin",
      "add bank",
      "withdraw",
    ];

    // Simple fuzzy matching
    const matches = commands.filter(
      (cmd) => this.similarity(input.toLowerCase(), cmd) > 0.3
    );

    return matches.slice(0, 3);
  }

  /**
   * Simple string similarity
   */
  private static similarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Levenshtein distance calculation
   */
  private static levenshteinDistance(s1: string, s2: string): number {
    const matrix = [];

    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[s2.length][s1.length];
  }

  /**
   * Format suggestions for WhatsApp
   */
  static formatSuggestions(suggestions: string[]): string {
    if (suggestions.length === 0) return "";

    let response = "\n*💡 Try these:*\n";
    suggestions.forEach((suggestion, index) => {
      response += `• ${suggestion}\n`;
    });

    return response;
  }

  /**
   * Get next action suggestions based on current context
   */
  static getNextActions(context: string): string[] {
    const nextActions: Record<string, string[]> = {
      card_created: ["buy cngn", "balance", "view card"],
      kyc_complete: ["setup pin", "create card", "help"],
      pin_setup: ["create card", "buy cngn", "balance"],
      balance_checked: ["buy cngn", "send money", "create card"],
      money_sent: ["balance", "history", "send more"],
      crypto_bought: ["balance", "send money", "create card"],
    };

    return nextActions[context] || ["help", "balance"];
  }
}
