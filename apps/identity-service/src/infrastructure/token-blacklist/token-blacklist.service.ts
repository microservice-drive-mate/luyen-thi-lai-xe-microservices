import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { TokenBlacklistPort } from '../../application/ports/token-blacklist.port';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class TokenBlacklistService extends TokenBlacklistPort {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async addToBlacklist(token: string, expiresAt: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const ttl = expiresAt - now;
    if (ttl <= 0) return;

    await this.redis.set(this.buildTokenKey(token), '1', 'EX', ttl);
  }

  async isBlacklisted(token: string): Promise<boolean> {
    const result = await this.redis.exists(this.buildTokenKey(token));
    return result === 1;
  }

  async removeFromBlacklist(token: string): Promise<void> {
    await this.redis.del(this.buildTokenKey(token));
  }

  async revokeUserTokensIssuedBefore(
    userId: string,
    issuedBefore: number,
  ): Promise<void> {
    await this.redis.set(this.buildUserRevocationKey(userId), issuedBefore);
  }

  async getUserRevokedAfter(userId: string): Promise<number | null> {
    const value = await this.redis.get(this.buildUserRevocationKey(userId));
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private buildTokenKey(token: string): string {
    const jti = this.extractJti(token);
    return `bl:${jti ?? token}`;
  }

  private buildUserRevocationKey(userId: string): string {
    return `auth:revoked-after:${userId}`;
  }

  private extractJti(token: string): string | null {
    try {
      const raw = token.startsWith('Bearer ') ? token.slice(7) : token;
      const parts = raw.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf-8'),
      ) as Record<string, unknown>;
      return typeof payload.jti === 'string' ? payload.jti : null;
    } catch {
      return null;
    }
  }
}
