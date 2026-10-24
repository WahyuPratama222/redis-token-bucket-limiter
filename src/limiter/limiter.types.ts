// Rule for one bucket; used by the decorator, the guard and the limiter
export interface RateLimitOptions {
  capacity: number; // max tokens the bucket holds
  refillPerSec: number; // tokens added per second
}

// Shared result shape so both limiters can be logged in the same format
export interface TakeResult {
  allowed: boolean;
  seen: string | null; // tokens value as read from Redis before taking (null = bucket didn't exist)
  left: number; // tokens remaining after this request
  retryAfterSec?: number; // seconds until the next token (only the Lua limiter fills this)
}