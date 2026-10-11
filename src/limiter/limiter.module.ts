import { Module } from '@nestjs/common';
import { LimiterController } from './limiter.controller';
import { NaiveLimiter } from './naive/naive.limiter';
import { LuaLimiter } from './lua/lua.limiter';

// RedisModule is @Global, so it doesn't need to be imported here
@Module({
  controllers: [LimiterController],
  providers: [NaiveLimiter, LuaLimiter],
  exports: [NaiveLimiter, LuaLimiter],
})
export class LimiterModule {}