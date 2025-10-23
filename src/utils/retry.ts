import { logger } from "./logger";

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: any) => boolean;
}

export class RetryError extends Error {
  public readonly attempts: number;
  public readonly lastError: Error;

  constructor(message: string, attempts: number, lastError: Error) {
    super(message);
    this.name = "RetryError";
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    retryCondition = (error: any) => {
      // Default: retry on network errors and 5xx server errors
      if (
        error.code === "ECONNRESET" ||
        error.code === "ENOTFOUND" ||
        error.code === "ETIMEDOUT"
      ) {
        return true;
      }
      if (error.response?.status >= 500) {
        return true;
      }
      return false;
    },
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry on the last attempt
      if (attempt > maxRetries) {
        break;
      }

      // Check if we should retry this error
      if (!retryCondition(error)) {
        logger.info(
          `Not retrying error (attempt ${attempt}/${maxRetries + 1}):`,
          {
            error: error.message,
            code: error.code,
            status: error.response?.status,
          }
        );
        throw error;
      }

      // Calculate delay with jitter to avoid thundering herd
      const jitter = Math.random() * 0.1 * delay; // 10% jitter
      const actualDelay = Math.min(delay + jitter, maxDelay);

      logger.warn(
        `Retrying operation (attempt ${attempt}/${
          maxRetries + 1
        }) after ${actualDelay}ms:`,
        {
          error: error.message,
          code: error.code,
          status: error.response?.status,
        }
      );

      await sleep(actualDelay);
      delay *= backoffFactor;
    }
  }

  throw new RetryError(
    `Operation failed after ${maxRetries + 1} attempts`,
    maxRetries + 1,
    lastError!
  );
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Circuit breaker pattern for API calls
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = "HALF_OPEN";
        logger.info("Circuit breaker transitioning to HALF_OPEN");
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }

    try {
      const result = await operation();

      if (this.state === "HALF_OPEN") {
        this.reset();
        logger.info("Circuit breaker transitioning to CLOSED");
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = "OPEN";
      logger.warn(
        `Circuit breaker transitioning to OPEN after ${this.failures} failures`
      );
    }
  }

  private reset(): void {
    this.failures = 0;
    this.state = "CLOSED";
  }

  getState(): string {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private requests: number[] = [];

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  async acquire(): Promise<void> {
    const now = Date.now();

    // Remove old requests outside the window
    this.requests = this.requests.filter((time) => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.windowMs - (now - oldestRequest);

      logger.info(`Rate limit reached, waiting ${waitTime}ms`);
      await sleep(waitTime);

      // Recursive call after waiting
      return this.acquire();
    }

    this.requests.push(now);
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter((time) => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - this.requests.length);
  }
}
