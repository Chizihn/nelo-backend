import { UserSession } from "@/types/whatsapp.types";
import { logger } from "@/utils/logger";
import { CONSTANTS } from "@/utils/constants";

export class InMemorySessionManager {
  private sessions: Map<string, UserSession> = new Map();

  async getSession(userId: string): Promise<UserSession | null> {
    try {
      const session = this.sessions.get(userId);

      if (!session) {
        return null;
      }

      // Check if session is expired
      const expiryTime = new Date(
        Date.now() - CONSTANTS.SESSION_EXPIRY_HOURS * 60 * 60 * 1000
      );
      if (new Date(session.lastActivity) < expiryTime) {
        this.sessions.delete(userId);
        return null;
      }

      return session;
    } catch (error) {
      logger.error("Error getting session:", error);
      return null;
    }
  }

  async getOrCreateSession(
    userId: string,
    whatsappNumber: string
  ): Promise<UserSession> {
    try {
      let session = await this.getSession(userId);

      if (!session) {
        session = {
          userId,
          whatsappNumber,
          currentFlow: undefined,
          flowData: {},
          lastActivity: new Date(),
          messageCount: 0,
        };

        this.sessions.set(userId, session);
        logger.info(`New session created for user ${userId}`);
      }

      return session;
    } catch (error) {
      logger.error("Error creating session:", error);
      throw error;
    }
  }

  async updateSession(
    userId: string,
    updates: Partial<UserSession>
  ): Promise<void> {
    try {
      const session = this.sessions.get(userId);
      if (!session) {
        logger.warn(`Session not found for user ${userId}`);
        return;
      }

      const updatedSession = { ...session, ...updates };
      this.sessions.set(userId, updatedSession);

      logger.debug(`Session updated for user ${userId}`);
    } catch (error) {
      logger.error("Error updating session:", error);
      throw error;
    }
  }
}
