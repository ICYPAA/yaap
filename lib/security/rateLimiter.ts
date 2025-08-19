/**
 * Client-side rate limiting to prevent API abuse
 */

interface RateLimitConfig {
  maxRequests: number;
  timeWindowMs: number;
  identifier?: string;
}

interface RequestRecord {
  timestamp: number;
  endpoint: string;
}

class RateLimiter {
  private requests: Map<string, RequestRecord[]> = new Map();
  private readonly defaultConfig: RateLimitConfig = {
    maxRequests: 100,
    timeWindowMs: 60000, // 1 minute
  };

  // Endpoint-specific limits
  private readonly endpointLimits: Map<string, RateLimitConfig> = new Map([
    ['/auth/login', { maxRequests: 5, timeWindowMs: 300000 }], // 5 attempts per 5 minutes
    ['/auth/register', { maxRequests: 3, timeWindowMs: 600000 }], // 3 attempts per 10 minutes
    ['/schedule/share', { maxRequests: 10, timeWindowMs: 60000 }], // 10 shares per minute
    ['/service/request', { maxRequests: 5, timeWindowMs: 300000 }], // 5 requests per 5 minutes
    ['/profile/update', { maxRequests: 10, timeWindowMs: 60000 }], // 10 updates per minute
  ]);

  /**
   * Checks if a request is within rate limits
   */
  async checkLimit(endpoint: string, identifier?: string): Promise<boolean> {
    const now = Date.now();
    const key = identifier || 'global';
    const config = this.getConfigForEndpoint(endpoint);

    // Get existing requests for this identifier
    const requests = this.requests.get(key) || [];

    // Filter out old requests outside the time window
    const validRequests = requests.filter(
      req => now - req.timestamp < config.timeWindowMs
    );

    // Check if limit exceeded
    if (validRequests.length >= config.maxRequests) {
      const oldestRequest = validRequests[0];
      const resetTime = oldestRequest.timestamp + config.timeWindowMs;
      const waitTime = Math.ceil((resetTime - now) / 1000);

      throw new RateLimitError(
        `Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`,
        waitTime,
        resetTime
      );
    }

    // Add the new request
    validRequests.push({ timestamp: now, endpoint });
    this.requests.set(key, validRequests);

    // Clean up old entries periodically
    this.cleanupOldEntries();

    return true;
  }

  /**
   * Gets the configuration for a specific endpoint
   */
  private getConfigForEndpoint(endpoint: string): RateLimitConfig {
    // Check for exact match
    if (this.endpointLimits.has(endpoint)) {
      return this.endpointLimits.get(endpoint)!;
    }

    // Check for pattern match
    for (const [pattern, config] of this.endpointLimits) {
      if (endpoint.startsWith(pattern.replace('*', ''))) {
        return config;
      }
    }

    return this.defaultConfig;
  }

  /**
   * Cleans up old entries to prevent memory leaks
   */
  private cleanupOldEntries(): void {
    const now = Date.now();
    const maxAge = Math.max(...Array.from(this.endpointLimits.values()).map(c => c.timeWindowMs));

    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(
        req => now - req.timestamp < maxAge
      );

      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }

  /**
   * Gets the current usage for an identifier
   */
  getUsage(identifier?: string): { current: number; max: number; resetTime: number } {
    const key = identifier || 'global';
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const config = this.defaultConfig;

    const validRequests = requests.filter(
      req => now - req.timestamp < config.timeWindowMs
    );

    const oldestRequest = validRequests[0];
    const resetTime = oldestRequest ? oldestRequest.timestamp + config.timeWindowMs : now + config.timeWindowMs;

    return {
      current: validRequests.length,
      max: config.maxRequests,
      resetTime
    };
  }

  /**
   * Resets the rate limit for a specific identifier
   */
  reset(identifier?: string): void {
    const key = identifier || 'global';
    this.requests.delete(key);
  }

  /**
   * Resets all rate limits
   */
  resetAll(): void {
    this.requests.clear();
  }
}

/**
 * Custom error class for rate limit errors
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
    public readonly resetTime: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// Singleton instance
let rateLimiterInstance: RateLimiter | null = null;

/**
 * Gets the singleton rate limiter instance
 */
export const getRateLimiter = (): RateLimiter => {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter();
  }
  return rateLimiterInstance;
};

/**
 * Middleware function for rate limiting
 */
export const withRateLimit = async <T>(
  endpoint: string,
  fn: () => Promise<T>,
  identifier?: string
): Promise<T> => {
  const limiter = getRateLimiter();

  try {
    await limiter.checkLimit(endpoint, identifier);
    return await fn();
  } catch (error) {
    if (error instanceof RateLimitError) {
      // Log rate limit violations for monitoring
      console.warn(`Rate limit exceeded for ${endpoint}:`, {
        identifier,
        retryAfter: error.retryAfterSeconds,
        resetTime: new Date(error.resetTime).toISOString()
      });
    }
    throw error;
  }
};

/**
 * Hook for React components to check rate limit status
 */
export const useRateLimit = (endpoint: string, identifier?: string) => {
  const limiter = getRateLimiter();
  return limiter.getUsage(identifier);
};