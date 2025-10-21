import { Redis } from "ioredis";
import { UserSession } from "@/types/whatsapp.types";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";
import { CONSTANTS } from "@/utils/constants";

export class SessionManager {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  /**
   * Get user session
   */
  async getSession(userId: string): Promise<UserSession | null> {
    try {
      const sessionData = await this.redis.get(`session:${userId}`);

      if (!sessionData) {
        return null;
      }

      const session = JSON.parse(sessionData) as UserSession;

      // Check if session is expired
      if (
        new Date(session.lastActivity) <
        new Date(Date.now() - CONSTANTS.SESSION_EXPIRY_HOURS * 60 * 60 * 1000)
      ) {
        await this.deleteSession(userId);
        return null;
      }

      return session;
    } catch (error) {
      logger.error("Error getting session:", error);
      return null;
    }
  }

  /**
   * Create or update session
   */
  async createSession(
    userId: string,
    whatsappNumber: string
  ): Promise<UserSession> {
    try {
      const session: UserSession = {
        userId,
        whatsappNumber,
        lastActivity: new Date(),
        messageCount: 0,
      };

      await this.redis.setex(
        `session:${userId}`,
        CONSTANTS.SESSION_EXPIRY_HOURS * 60 * 60,
        JSON.stringify(session)
      );

      logger.info(`Session created for user ${userId}`);
      return session;
    } catch (error) {
      logger.error("Error creating session:", error);
      throw error;
    }
  }

  /**
   * Get or create session
   */
  async getOrCreateSession(
    userId: string,
    whatsappNumber: string
  ): Promise<UserSession> {
    let session = await this.getSession(userId);

    if (!session) {
      session = await this.createSession(userId, whatsappNumber);
    }

    return session;
  }

  /**
   * Update session data
   */
  async updateSession(
    userId: string,
    updates: Partial<UserSession>
  ): Promise<void> {
    try {
      const session = await this.getSession(userId);

      if (!session) {
        logger.warn(
          `Attempted to update non-existent session for user ${userId}`
        );
        return;
      }

      const updatedSession = { ...session, ...updates };

      await this.redis.setex(
        `session:${userId}`,
        CONSTANTS.SESSION_EXPIRY_HOURS * 60 * 60,
        JSON.stringify(updatedSession)
      );
    } catch (error) {
      logger.error("Error updating session:", error);
    }
  }

  /**
   * Delete session
   */
  async deleteSession(userId: string): Promise<void> {
    try {
      await this.redis.del(`session:${userId}`);
      logger.info(`Session deleted for user ${userId}`);
    } catch (error) {
      logger.error("Error deleting session:", error);
    }
  }

  /**
   * Set conversation flow
   */
  async setFlow(
    userId: string,
    flowName: string,
    flowData?: any
  ): Promise<void> {
    try {
      await this.updateSession(userId, {
        currentFlow: flowName,
        flowData: flowData || {},
      });
    } catch (error) {
      logger.error("Error setting flow:", error);
    }
  }

  /**
   * Clear conversation flow
   */
  async clearFlow(userId: string): Promise<void> {
    try {
      await this.updateSession(userId, {
        currentFlow: undefined,
        flowData: undefined,
      });
    } catch (error) {
      logger.error("Error clearing flow:", error);
    }
  }

  /**
   * Get active sessions count
   */
  async getActiveSessionsCount(): Promise<number> {
    try {
      const keys = await this.redis.keys("session:*");
      return keys.length;
    } catch (error) {
      logger.error("Error getting active sessions count:", error);
      return 0;
    }
  }

  /**
   * Clean expired sessions
   */
  async cleanExpiredSessions(): Promise<number> {
    try {
      const keys = await this.redis.keys("session:*");
      let cleanedCount = 0;

      for (const key of keys) {
        const sessionData = await this.redis.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData) as UserSession;
          const expiryTime = new Date(
            Date.now() - CONSTANTS.SESSION_EXPIRY_HOURS * 60 * 60 * 1000
          );

          if (new Date(session.lastActivity) < expiryTime) {
            await this.redis.del(key);
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned ${cleanedCount} expired sessions`);
      }

      return cleanedCount;
    } catch (error) {
      logger.error("Error cleaning expired sessions:", error);
      return 0;
    }
  }

  /**
   * Store temporary data
   */
  async setTempData(
    userId: string,
    key: string,
    data: any,
    ttlSeconds: number = 300
  ): Promise<void> {
    try {
      await this.redis.setex(
        `temp:${userId}:${key}`,
        ttlSeconds,
        JSON.stringify(data)
      );
    } catch (error) {
      logger.error("Error setting temp data:", error);
    }
  }

  /**
   * Get temporary data
   */
  async getTempData(userId: string, key: string): Promise<any> {
    try {
      const data = await this.redis.get(`temp:${userId}:${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error("Error getting temp data:", error);
      return null;
    }
  }

  /**
   * Delete temporary data
   */
  async deleteTempData(userId: string, key: string): Promise<void> {
    try {
      await this.redis.del(`temp:${userId}:${key}`);
    } catch (error) {
      logger.error("Error deleting temp data:", error);
    }
  }

  /**
   * Rate limiting check
   */
  async checkRateLimit(
    userId: string,
    action: string,
    limit: number = 10,
    windowSeconds: number = 60
  ): Promise<boolean> {
    try {
      const key = `rate:${userId}:${action}`;
      const current = await this.redis.incr(key);

      if (current === 1) {
        await this.redis.expire(key, windowSeconds);
      }

      return current <= limit;
    } catch (error) {
      logger.error("Error checking rate limit:", error);
      return true; // Allow on error
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}
