import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class TokenBlacklistService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async addToBlacklist(token: string, expiresAt: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const ttl = expiresAt - now;
    if (ttl <= 0) return;

    const key = this.buildKey(token);
    await this.redis.set(key, '1', 'EX', ttl);
  }

  async isBlacklisted(token: string): Promise<boolean> {
    const key = this.buildKey(token);
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async removeFromBlacklist(token: string): Promise<void> {
    const key = this.buildKey(token);
    await this.redis.del(key);
  }

  // Dùng jti claim nếu có, fallback về raw token (jti ngắn hơn và là UUID duy nhất)
  private buildKey(token: string): string {
    const jti = this.extractJti(token);
    return `bl:${jti ?? token}`;
  }

  private extractJti(token: string): string | null {
    try {
      const raw = token.startsWith('Bearer ') ? token.slice(7) : token;
      const parts = raw.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8'),
      ) as Record<string, unknown>;
      return typeof payload.jti === 'string' ? payload.jti : null;
    } catch {
      return null;
    }
  }
}
