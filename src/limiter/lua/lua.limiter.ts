import { Injectable, OnModuleInit } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisService } from '../../redis/redis.service';
import type { RateLimitOptions, TakeResult } from '../limiter.types';
import { TOKEN_BUCKET_SCRIPT } from './token-bucket.script';

// Same defaults as the naive version, so the /lua demo endpoint stays a fair comparison
const DEFAULT_OPTIONS: RateLimitOptions = { capacity: 5, refillPerSec: 1 / 60 };

// ioredis adds the custom command at runtime, so its type is declared here
type TokenBucketRedis = Redis & {
  takeTokenBucket(
    key: string,
    capacity: number,
    refillPerSec: number,
  ): Promise<[number, string, string, string]>;
};

@Injectable()
export class LuaLimiter implements OnModuleInit {
  constructor(private readonly redisService: RedisService) {}

  // Register the script once; later calls send only its SHA1 hash (EVALSHA)
  onModuleInit() {
    this.redisService.redisClient.defineCommand('takeTokenBucket', {
      numberOfKeys: 1,
      lua: TOKEN_BUCKET_SCRIPT,
    });
  }

  async takeToken(key: string, options: RateLimitOptions = DEFAULT_OPTIONS): Promise<TakeResult> {
    const redis = this.redisService.redisClient as TokenBucketRedis;

    // Still one round trip, and Redis still runs the whole script without interruption
    const [allowed, seen, left, retry] = await redis.takeTokenBucket(
      key,
      options.capacity,
      options.refillPerSec,
    );

    return {
      allowed: allowed === 1,
      seen,
      left: Number(left),
      retryAfterSec: Number(retry),
    };
  }
}