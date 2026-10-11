import { Controller, Get, HttpException, HttpStatus, Logger, Query } from '@nestjs/common';
import type { TakeResult } from './limiter.types';
import { LuaLimiter } from './lua/lua.limiter';
import { NaiveLimiter } from './naive/naive.limiter';

// Demo endpoints used only for the load test; the reusable part will be the Guard later
@Controller()
export class LimiterController {
  private readonly logger = new Logger('Limiter');

  constructor(
    private readonly naiveLimiter: NaiveLimiter,
    private readonly luaLimiter: LuaLimiter,
  ) {}

  // Shared flow for both endpoints, so there is exactly one log line per request
  private async handle(
    endpoint: string,
    user: string,
    takeToken: (key: string) => Promise<TakeResult>,
  ) {
    const result = await takeToken(`${endpoint}:${user}`);
    const status = result.allowed ? 200 : 429;

    // ISO timestamp has millisecond precision; "read" shows what this request saw in Redis
    this.logger.log(
      `${new Date().toISOString()} [:${process.env.PORT ?? 3000}] GET /${endpoint}?user=${user} -> ${status} | read=${result.seen} left=${result.left.toFixed(2)}`,
    );

    if (!result.allowed) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS); // HTTP 429
    }
    return { allowed: true };
  }

  // GET /naive?user=user1
  @Get('naive')
  naive(@Query('user') user = 'user1') {
    return this.handle('naive', user, (key) => this.naiveLimiter.takeToken(key));
  }

  // GET /lua?user=user1
  @Get('lua')
  lua(@Query('user') user = 'user1') {
    return this.handle('lua', user, (key) => this.luaLimiter.takeToken(key));
  }
}