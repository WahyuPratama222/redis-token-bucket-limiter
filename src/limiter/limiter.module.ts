import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LimiterController } from './limiter.controller';
import { LuaLimiter } from './lua/lua.limiter';
import { NaiveLimiter } from './naive/naive.limiter';
import { RateLimitGuard } from './rate-limit/rate-limit.guard';

// RedisModule is @Global, so it doesn't need to be imported here
@Module({
  controllers: [LimiterController],
  providers: [
    NaiveLimiter,
    LuaLimiter,
    // Runs on every route, but only enforces routes that carry @RateLimit
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
  exports: [NaiveLimiter, LuaLimiter],
})
export class LimiterModule {}