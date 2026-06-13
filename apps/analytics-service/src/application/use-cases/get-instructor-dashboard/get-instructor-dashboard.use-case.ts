import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import {
  createInstructorDashboardPeriod,
  toDateKey,
} from '../../../domain/dashboard/instructor-dashboard.period';
import { InstructorDashboard } from '../../../domain/dashboard/instructor-dashboard.types';
import { InstructorDashboardRepository } from '../../../domain/repositories/instructor-dashboard.repository';
import { ProgressCacheService } from '../../../infrastructure/cache/progress-cache.service';
import { GetInstructorDashboardQuery } from './get-instructor-dashboard.query';

@Injectable()
export class GetInstructorDashboardUseCase
  implements IUseCase<GetInstructorDashboardQuery, InstructorDashboard>
{
  constructor(
    private readonly repository: InstructorDashboardRepository,
    private readonly cache: ProgressCacheService,
  ) {}

  async execute(
    query: GetInstructorDashboardQuery,
  ): Promise<InstructorDashboard> {
    const period = createInstructorDashboardPeriod(query);
    const cacheKey = `${period.month}:${toDateKey(period.weekStart)}:${toDateKey(
      period.date,
    )}`;
    const cached = await this.cache.getInstructorDashboard<InstructorDashboard>(
      query.instructorId,
      cacheKey,
    );
    if (cached) return cached;

    const dashboard = await this.repository.getDashboard(
      query.instructorId,
      period,
    );
    await this.cache.setInstructorDashboard(
      query.instructorId,
      cacheKey,
      dashboard,
    );
    return dashboard;
  }
}
