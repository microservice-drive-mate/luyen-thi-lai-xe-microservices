import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import {
  LearningProgressRepository,
  ProgressDashboard,
} from '../../../domain/repositories/learning-progress.repository';
import { ProgressCacheService } from '../../../infrastructure/cache/progress-cache.service';
import { GetProgressQuery } from './get-progress.query';

@Injectable()
export class GetProgressUseCase
  implements IUseCase<GetProgressQuery, ProgressDashboard>
{
  constructor(
    private readonly repository: LearningProgressRepository,
    private readonly cache: ProgressCacheService,
  ) {}

  async execute(query: GetProgressQuery): Promise<ProgressDashboard> {
    const cached = await this.cache.get(query.studentId, query.licenseTier);
    if (cached) return cached;
    const dashboard = await this.repository.getDashboard(query.studentId);
    await this.cache.set(query.studentId, dashboard, query.licenseTier);
    return dashboard;
  }
}
