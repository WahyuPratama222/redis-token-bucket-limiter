import { Module } from '@nestjs/common';
import { RedisModule } from './redis/redis.module';
import { LimiterModule } from './limiter/limiter.module';

@Module({
  imports: [RedisModule, LimiterModule],
})
export class AppModule {}