import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { AdminDashboard } from '../../domain/dashboard/admin-dashboard.types';
import { ProgressDashboard } from '../../domain/repositories/learning-progress.repository';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class ProgressCacheService {
  private readonly ttlSeconds = 120;
  private readonly adminDashboardTtlSeconds = 60;

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

  async getAdminDashboard(month: string): Promise<AdminDashboard | null> {
    try {
      const raw = await this.redis.get(this.adminDashboardKey(month));
      return raw ? reviveAdminDashboard(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  async setAdminDashboard(
    month: string,
    dashboard: AdminDashboard,
  ): Promise<void> {
    try {
      await this.redis.set(
        this.adminDashboardKey(month),
        JSON.stringify(dashboard),
        'EX',
        this.adminDashboardTtlSeconds,
      );
    } catch {
      // Analytics remains available from PostgreSQL if Redis is unavailable.
    }
  }

  async invalidateAdminDashboard(): Promise<void> {
    try {
      const keys = await this.redis.keys('analytics:admin-dashboard:*');
      if (keys.length > 0) await this.redis.del(keys);
    } catch {
      // Best-effort cache invalidation.
    }
  }

  private key(studentId: string, licenseTier?: string | null): string {
    return `analytics:progress:${studentId}:${licenseTier ?? 'default'}`;
  }

  private adminDashboardKey(month: string): string {
    return `analytics:admin-dashboard:${month}`;
  }
}

function reviveAdminDashboard(value: unknown): AdminDashboard | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const dashboard = value as AdminDashboard;
  return {
    ...dashboard,
    period: {
      ...dashboard.period,
      currentFrom: new Date(dashboard.period.currentFrom),
      currentTo: new Date(dashboard.period.currentTo),
      previousFrom: new Date(dashboard.period.previousFrom),
      previousTo: new Date(dashboard.period.previousTo),
    },
    recentActivities: dashboard.recentActivities.map((activity) => ({
      ...activity,
      occurredAt: new Date(activity.occurredAt),
    })),
  };
}
