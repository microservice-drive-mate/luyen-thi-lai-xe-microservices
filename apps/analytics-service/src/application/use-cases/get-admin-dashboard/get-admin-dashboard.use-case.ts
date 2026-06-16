import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { DashboardMetricCalculator } from '../../../domain/dashboard/dashboard-metric.calculator';
import { AdminDashboard } from '../../../domain/dashboard/admin-dashboard.types';
import { AdminDashboardRepository } from '../../../domain/repositories/admin-dashboard.repository';
import { ProgressCacheService } from '../../../infrastructure/cache/progress-cache.service';
import { GetAdminDashboardQuery } from './get-admin-dashboard.query';

@Injectable()
export class GetAdminDashboardUseCase
  implements IUseCase<GetAdminDashboardQuery, AdminDashboard>
{
  constructor(
    private readonly repository: AdminDashboardRepository,
    private readonly cache: ProgressCacheService,
  ) {}

  async execute(query: GetAdminDashboardQuery): Promise<AdminDashboard> {
    const calculator = new DashboardMetricCalculator();
    const period = calculator.createPeriod(query.month);
    const cached = await this.cache.getAdminDashboard(period.month);
    if (cached) {
      return cached;
    }

    const dashboard = await this.repository.getDashboard(period);
    await this.cache.setAdminDashboard(period.month, dashboard);
    return dashboard;
  }
}
