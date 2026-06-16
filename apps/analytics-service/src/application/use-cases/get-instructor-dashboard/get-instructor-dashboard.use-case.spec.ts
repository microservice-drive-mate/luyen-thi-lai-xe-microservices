import { InstructorDashboard } from '../../../domain/dashboard/instructor-dashboard.types';
import { InstructorDashboardRepository } from '../../../domain/repositories/instructor-dashboard.repository';
import { ProgressCacheService } from '../../../infrastructure/cache/progress-cache.service';
import { GetInstructorDashboardQuery } from './get-instructor-dashboard.query';
import { GetInstructorDashboardUseCase } from './get-instructor-dashboard.use-case';

describe('GetInstructorDashboardUseCase', () => {
  const dashboard: InstructorDashboard = {
    period: {
      month: '2026-06',
      weekStart: '2026-06-08',
      date: '2026-06-13',
      timezone: 'Asia/Ho_Chi_Minh',
    },
    summary: {
      activeClassCount: 2,
      totalStudents: 42,
      passRate: 80,
      teachingHoursThisMonth: 32,
    },
    weeklyTeachingTrend: [],
    topicAverages: [],
    classProgress: [],
    todaySchedule: [],
  };

  function createUseCase() {
    const repository = {
      getDashboard: jest.fn(),
    } as unknown as jest.Mocked<InstructorDashboardRepository>;
    const cache = {
      getInstructorDashboard: jest.fn(),
      setInstructorDashboard: jest.fn(),
    } as unknown as jest.Mocked<ProgressCacheService>;
    const useCase = new GetInstructorDashboardUseCase(repository, cache);
    return { cache, repository, useCase };
  }

  it('returns cached dashboard when available', async () => {
    const { cache, repository, useCase } = createUseCase();
    cache.getInstructorDashboard.mockResolvedValue(dashboard);

    const result = await useCase.execute(
      new GetInstructorDashboardQuery(
        'instructor-1',
        '2026-06',
        '2026-06-08',
        '2026-06-13',
      ),
    );

    expect(result).toBe(dashboard);
    expect(repository.getDashboard).not.toHaveBeenCalled();
    expect(cache.setInstructorDashboard).not.toHaveBeenCalled();
  });

  it('loads dashboard and stores it in cache on miss', async () => {
    const { cache, repository, useCase } = createUseCase();
    cache.getInstructorDashboard.mockResolvedValue(null);
    repository.getDashboard.mockResolvedValue(dashboard);

    const result = await useCase.execute(
      new GetInstructorDashboardQuery(
        'instructor-1',
        '2026-06',
        '2026-06-08',
        '2026-06-13',
      ),
    );

    expect(result).toBe(dashboard);
    expect(repository.getDashboard).toHaveBeenCalledWith(
      'instructor-1',
      expect.objectContaining({ month: '2026-06' }),
    );
    expect(cache.setInstructorDashboard).toHaveBeenCalledWith(
      'instructor-1',
      '2026-06:2026-06-08:2026-06-13',
      dashboard,
    );
  });
});
