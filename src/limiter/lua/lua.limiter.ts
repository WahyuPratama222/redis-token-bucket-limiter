import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import type { TakeResult } from '../limiter.types';
import { TOKEN_BUCKET_SCRIPT } from './token-bucket.script';

const CAPACITY = 5; // same settings as the naive version, so the test is a fair comparison
const REFILL_PER_SEC = 1 / 60;

@Injectable()
export class LuaLimiter {
  constructor(private readonly redisService: RedisService) {}

  async takeToken(key: string): Promise<TakeResult> {
    // One round trip: Redis runs the whole script without interruption
    const [allowed, seen, left] = (await this.redisService.redisClient.eval(
      TOKEN_BUCKET_SCRIPT,
      1, // number of KEYS
      key,
      CAPACITY,
      REFILL_PER_SEC,
    )) as [number, string, string];

    return { allowed: allowed === 1, seen, left: Number(left) };
  }
}