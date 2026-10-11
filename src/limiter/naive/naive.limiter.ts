import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import type { TakeResult } from '../limiter.types';

const CAPACITY = 5; // bucket holds at most 5 tokens
const REFILL_PER_SEC = 1 / 60; // very slow refill (1 token per minute) to keep tests clean

@Injectable()
export class NaiveLimiter {
  constructor(private readonly redisService: RedisService) {}

  async takeToken(key: string): Promise<TakeResult> {
    const redis = this.redisService.redisClient;

    // Step 1: read the two stored values (round trip to Redis)
    const [tokensRaw, tsRaw] = await redis.hmget(key, 'tokens', 'ts');

    const now = Date.now() / 1000;
    let tokens = tokensRaw === null ? CAPACITY : Number(tokensRaw); // new bucket starts full
    const ts = tsRaw === null ? now : Number(tsRaw);

    // Step 2: refill based on elapsed time, capped at capacity (computed in the app)
    tokens = Math.min(CAPACITY, tokens + (now - ts) * REFILL_PER_SEC);

    // Step 3: take one token if available
    let allowed = false;
    if (tokens >= 1) {
      tokens -= 1;
      allowed = true;
    }

    // Step 4: write back (another round trip; the race condition gap is here)
    await redis.hset(key, 'tokens', tokens, 'ts', now);

    return { allowed, seen: tokensRaw, left: tokens };
  }
}