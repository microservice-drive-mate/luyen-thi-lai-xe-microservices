import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { ProgressDashboard } from '../../domain/repositories/learning-progress.repository';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class ProgressCacheService {
  private readonly ttlSeconds = 120;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get(
    studentId: string,
    licenseTier?: string | null,
  ): Promise<ProgressDashboard | null> {
    try {
      const raw = await this.redis.get(this.key(studentId, licenseTier));
      return raw ? (JSON.parse(raw) as ProgressDashboard) : null;
    } catch {
      return null;
    }
  }

  async set(
    studentId: string,
    dashboard: ProgressDashboard,
    licenseTier?: string | null,
  ): Promise<void> {
    try {
      await this.redis.set(
        this.key(studentId, licenseTier),
        JSON.stringify(dashboard),
        'EX',
        this.ttlSeconds,
      );
    } catch {
      // Analytics remains available from PostgreSQL if Redis is unavailable.
    }
  }

  async invalidate(studentId: string): Promise<void> {
    try {
      const keys = await this.redis.keys(`analytics:progress:${studentId}:*`);
      if (keys.length > 0) await this.redis.del(keys);
      await this.redis.del(this.key(studentId));
    } catch {
      // Best-effort cache invalidation.
    }
  }

  private key(studentId: string, licenseTier?: string | null): string {
    return `analytics:progress:${studentId}:${licenseTier ?? 'default'}`;
  }
}
