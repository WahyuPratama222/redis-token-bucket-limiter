import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  // Expose the raw client; the limiter needs hmget/hset now and eval later
  get redisClient(): Redis {
    return this.client;
  }

  // Close the connection cleanly when the app shuts down
  async onModuleDestroy() {
    await this.client.quit();
  }
}