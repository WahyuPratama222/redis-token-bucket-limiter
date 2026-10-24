import { SetMetadata } from '@nestjs/common';
import type { RateLimitOptions } from '../limiter.types';

export const RATE_LIMIT_KEY = 'rate_limit';

// Usage: @RateLimit({ capacity: 5, refillPerSec: 1 / 60 }) on a route or a whole controller
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);