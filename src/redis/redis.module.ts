import { Global, Logger, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

const logger = new Logger('Redis');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      // Falls back to local docker compose Redis so no .env is needed to start
      useFactory: () => {
        const client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
          // Fail a command after 1 reconnect attempt instead of the default 20 (~10s of waiting),
          // so the guard's fail-open path kicks in quickly when Redis is down
          maxRetriesPerRequest: 1,
        });
        // Without a listener ioredis prints "Unhandled error event" on every failed reconnect
        client.on('error', (err) => logger.warn(`Redis error: ${err.message}`));
        return client;
      },
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}