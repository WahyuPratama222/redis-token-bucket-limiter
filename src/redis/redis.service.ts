import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  // Expose the raw client; the limiters call hmget/hset (naive) and the custom Lua command
  get redisClient(): Redis {
    return this.client;
  }

  // Close the connection cleanly when the app shuts down
  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis connection closed'); // proof that the shutdown hook really ran
  }
}