import { logger } from "@/utils/logger";

export interface MockVirtualCard {
  id: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  brand: "visa" | "mastercard";
  currency: string;
  status: "active" | "suspended" | "closed";
  balance: number;
  maskedPan: string;
  last4: string;
}

export class MockCardService {
  /**
   * Generate mock card number
   */
  private static generateCardNumber(brand: "visa" | "mastercard"): string {
    // Visa starts with 4, Mastercard starts with 5
    const prefix = brand === "visa" ? "4" : "5";
    let cardNumber = prefix;

    // Generate remaining 15 digits
    for (let i = 0; i < 15; i++) {
      cardNumber += Math.floor(Math.random() * 10).toString();
    }

    return cardNumber;
  }

  /**
   * Generate mock CVV
   */
  private static generateCVV(): string {
    return Math.floor(100 + Math.random() * 900).toString();
  }

  /**
   * Generate mock expiry date (2-3 years from now)
   */
  private static generateExpiry(): { month: string; year: string } {
    const currentDate = new Date();
    const expiryYear =
      currentDate.getFullYear() + 2 + Math.floor(Math.random() * 2); // 2-3 years
    const expiryMonth = Math.floor(1 + Math.random() * 12); // 1-12

    return {
      month: expiryMonth.toString().padStart(2, "0"),
      year: expiryYear.toString(),
    };
  }

  /**
   * Create a mock virtual card
   */
  static createMockCard(userId: string): MockVirtualCard {
    const brand = Math.random() > 0.5 ? "visa" : "mastercard";
    const cardNumber = this.generateCardNumber(brand);
    const expiry = this.generateExpiry();
    const cvv = this.generateCVV();

    const mockCard: MockVirtualCard = {
      id: `mock_card_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 11)}`,
      cardNumber,
      expiryMonth: expiry.month,
      expiryYear: expiry.year,
      cvv,
      brand,
      currency: "NGN",
      status: "active",
      balance: 0,
      maskedPan: `**** **** **** ${cardNumber.slice(-4)}`,
      last4: cardNumber.slice(-4),
    };

    logger.info(`Mock virtual card created: ${mockCard.id} for user ${userId}`);

    return mockCard;
  }

  /**
   * Simulate card funding
   */
  static fundMockCard(
    cardId: string,
    amount: number
  ): {
    success: boolean;
    newBalance: number;
    transactionId: string;
  } {
    const transactionId = `mock_tx_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;

    logger.info(
      `Mock card funding: ${amount} NGN to card ${cardId}, TX: ${transactionId}`
    );

    return {
      success: true,
      newBalance: amount, // For demo, just set balance to the funded amount
      transactionId,
    };
  }

  /**
   * Simulate card payment
   */
  static processMockPayment(
    cardId: string,
    amount: number,
    merchant: string
  ): {
    success: boolean;
    transactionId: string;
    remainingBalance: number;
  } {
    const transactionId = `mock_payment_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;

    logger.info(
      `Mock card payment: ${amount} NGN at ${merchant}, card ${cardId}, TX: ${transactionId}`
    );

    return {
      success: true,
      transactionId,
      remainingBalance: Math.max(0, 1000 - amount), // Mock remaining balance
    };
  }

  /**
   * Get mock card details
   */
  static getMockCardDetails(cardId: string): MockVirtualCard | null {
    // In a real implementation, this would fetch from database
    // For demo, return a sample card
    return {
      id: cardId,
      cardNumber: "4532123456789012",
      expiryMonth: "12",
      expiryYear: "2027",
      cvv: "123",
      brand: "visa",
      currency: "NGN",
      status: "active",
      balance: 0,
      maskedPan: "**** **** **** 9012",
      last4: "9012",
    };
  }

  /**
   * Generate mock transaction history
   */
  static getMockTransactions(cardId: string): Array<{
    id: string;
    type: "funding" | "payment" | "refund";
    amount: number;
    merchant?: string;
    status: "completed" | "pending" | "failed";
    timestamp: string;
  }> {
    return [
      {
        id: "mock_tx_1",
        type: "funding",
        amount: 10000,
        status: "completed",
        timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      },
      {
        id: "mock_tx_2",
        type: "payment",
        amount: 2500,
        merchant: "Jumia",
        status: "completed",
        timestamp: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
      },
      {
        id: "mock_tx_3",
        type: "payment",
        amount: 1200,
        merchant: "Uber",
        status: "completed",
        timestamp: new Date(Date.now() - 21600000).toISOString(), // 6 hours ago
      },
    ];
  }

  /**
   * Validate card details format
   */
  static validateCardDetails(card: Partial<MockVirtualCard>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (card.cardNumber && !/^\d{16}$/.test(card.cardNumber)) {
      errors.push("Invalid card number format");
    }

    if (card.cvv && !/^\d{3}$/.test(card.cvv)) {
      errors.push("Invalid CVV format");
    }

    if (
      card.expiryMonth &&
      (parseInt(card.expiryMonth) < 1 || parseInt(card.expiryMonth) > 12)
    ) {
      errors.push("Invalid expiry month");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
