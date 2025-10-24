import { logger } from "@/utils/logger";

export interface UserSession {
  userId: string;
  whatsappNumber: string;
  currentFlow?: string;
  flowStep?: number;
  flowData?: any;
  lastActivity: Date;
  messageCount: number;
  awaitingPin?: boolean;
  awaitingSecurityAnswer?: boolean;
  pendingTransaction?: any;
  expiresAt: number; // Add explicit expiry timestamp

  // Card selection properties
  awaitingCardSelection?: boolean;
  cardSelectionType?: "VIEW" | "FUND" | "MANAGE";
  availableCards?: any[];
}

export class SessionManager {
  private static sessions = new Map<string, UserSession>();
  private static readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  /**
   * Get or create session for user
   */
  static getOrCreateSession(
    userId: string,
    whatsappNumber: string
  ): UserSession {
    let session = this.sessions.get(whatsappNumber);

    if (!session) {
      session = {
        userId,
        whatsappNumber,
        lastActivity: new Date(),
        messageCount: 0,
        expiresAt: Date.now() + this.SESSION_TIMEOUT,
      };
      this.sessions.set(whatsappNumber, session);
      logger.info(`New session created for user: ${whatsappNumber}`);
    } else {
      // Check if expired (Edge Case #8)
      if (session.expiresAt < Date.now()) {
        this.sessions.delete(whatsappNumber);
        // Create new session
        session = {
          userId,
          whatsappNumber,
          lastActivity: new Date(),
          messageCount: 0,
          expiresAt: Date.now() + this.SESSION_TIMEOUT,
        };
        this.sessions.set(whatsappNumber, session);
        logger.info(`Expired session replaced for user: ${whatsappNumber}`);
      } else {
        // Extend expiry
        session.lastActivity = new Date();
        session.messageCount++;
        session.expiresAt = Date.now() + this.SESSION_TIMEOUT;
      }
    }

    return session;
  }

  /**
   * Update session
   */
  static updateSession(
    whatsappNumber: string,
    updates: Partial<UserSession>
  ): void {
    const session = this.sessions.get(whatsappNumber);
    if (session) {
      Object.assign(session, updates);
      session.lastActivity = new Date();
    }
  }

  /**
   * Start a flow (PIN setup, KYC, etc.)
   */
  static startFlow(
    whatsappNumber: string,
    flowName: string,
    initialData?: any
  ): void {
    this.updateSession(whatsappNumber, {
      currentFlow: flowName,
      flowStep: 1,
      flowData: initialData || {},
    });
    logger.info(`Started flow '${flowName}' for user: ${whatsappNumber}`);
  }

  /**
   * Advance flow to next step
   */
  static advanceFlow(whatsappNumber: string, stepData?: any): void {
    const session = this.sessions.get(whatsappNumber);
    if (session && session.currentFlow) {
      session.flowStep = (session.flowStep || 1) + 1;
      if (stepData) {
        session.flowData = { ...session.flowData, ...stepData };
      }
      session.lastActivity = new Date();
    }
  }

  /**
   * Complete current flow
   */
  static completeFlow(whatsappNumber: string): void {
    this.updateSession(whatsappNumber, {
      currentFlow: undefined,
      flowStep: undefined,
      flowData: undefined,
    });
  }

  /**
   * Cancel current flow
   */
  static cancelFlow(whatsappNumber: string): void {
    this.completeFlow(whatsappNumber);
    logger.info(`Flow cancelled for user: ${whatsappNumber}`);
  }

  /**
   * Set awaiting PIN state
   */
  static setAwaitingPin(
    whatsappNumber: string,
    pendingTransaction?: any
  ): void {
    this.updateSession(whatsappNumber, {
      awaitingPin: true,
      pendingTransaction,
    });
  }

  /**
   * Clear awaiting PIN state
   */
  static clearAwaitingPin(whatsappNumber: string): void {
    this.updateSession(whatsappNumber, {
      awaitingPin: false,
      pendingTransaction: undefined,
    });
  }

  /**
   * Set awaiting security answer state
   */
  static setAwaitingSecurityAnswer(whatsappNumber: string): void {
    this.updateSession(whatsappNumber, {
      awaitingSecurityAnswer: true,
    });
  }

  /**
   * Clear awaiting security answer state
   */
  static clearAwaitingSecurityAnswer(whatsappNumber: string): void {
    this.updateSession(whatsappNumber, {
      awaitingSecurityAnswer: false,
    });
  }

  /**
   * Get session
   */
  static getSession(whatsappNumber: string): UserSession | undefined {
    return this.sessions.get(whatsappNumber);
  }

  /**
   * Check if user is in a flow
   */
  static isInFlow(whatsappNumber: string): boolean {
    const session = this.sessions.get(whatsappNumber);
    return !!(session && session.currentFlow);
  }

  /**
   * Check if user is awaiting PIN
   */
  static isAwaitingPin(whatsappNumber: string): boolean {
    const session = this.sessions.get(whatsappNumber);
    return !!(session && session.awaitingPin);
  }

  /**
   * Check if user is awaiting card selection
   */
  static isAwaitingCardSelection(whatsappNumber: string): boolean {
    const session = this.sessions.get(whatsappNumber);
    return !!(session && session.awaitingCardSelection);
  }

  /**
   * Check if user is awaiting security answer
   */
  static isAwaitingSecurityAnswer(whatsappNumber: string): boolean {
    const session = this.sessions.get(whatsappNumber);
    return !!(session && session.awaitingSecurityAnswer);
  }

  /**
   * Clean up expired sessions
   */
  static cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [whatsappNumber, session] of this.sessions.entries()) {
      if (now - session.lastActivity.getTime() > this.SESSION_TIMEOUT) {
        this.sessions.delete(whatsappNumber);
        cleanedCount++;
        logger.info(`Cleaned up expired session: ${whatsappNumber}`);
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired sessions total`);
    }
  }

  /**
   * Get session statistics
   */
  static getStats(): {
    totalSessions: number;
    activeSessions: number;
    flowSessions: number;
  } {
    const now = Date.now();
    let activeSessions = 0;
    let flowSessions = 0;

    for (const session of this.sessions.values()) {
      if (now - session.lastActivity.getTime() < this.SESSION_TIMEOUT) {
        activeSessions++;
        if (session.currentFlow) {
          flowSessions++;
        }
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      flowSessions,
    };
  }
}

// Clean up expired sessions every 10 minutes
setInterval(() => {
  SessionManager.cleanupExpiredSessions();
}, 10 * 60 * 1000);
