import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { RateLimitOptions } from '../limiter.types';
import { LuaLimiter } from '../lua/lua.limiter';
import { RATE_LIMIT_KEY } from './rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly luaLimiter: LuaLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Read the rule from the decorator (the route's rule wins over the controller's)
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @RateLimit on this route, so nothing to enforce
    if (!options) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    // One bucket per route per client IP; the client cannot choose its own identity
    const route = `${context.getClass().name}.${context.getHandler().name}`;
    const result = await this.luaLimiter.takeToken(`rl:${route}:${req.ip}`, options);

    res.setHeader('X-RateLimit-Limit', options.capacity);
    res.setHeader('X-RateLimit-Remaining', Math.floor(result.left));

    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil(result.retryAfterSec ?? 1));
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS); // HTTP 429
    }
    return true;
  }
}