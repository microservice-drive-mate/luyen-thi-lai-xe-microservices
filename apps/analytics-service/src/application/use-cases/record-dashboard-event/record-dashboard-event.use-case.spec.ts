import { AdminDashboardRepository } from '../../../domain/repositories/admin-dashboard.repository';
import { ProgressCacheService } from '../../../infrastructure/cache/progress-cache.service';
import { RecordDashboardEventUseCase } from './record-dashboard-event.use-case';

describe('RecordDashboardEventUseCase', () => {
  const repository = {
    hasProcessedEvent: jest.fn(),
    upsertUserProjection: jest.fn(),
    upsertCourseProjection: jest.fn(),
    recordExamCompleted: jest.fn(),
    recordActivity: jest.fn(),
    markProcessedEvent: jest.fn(),
  } as unknown as jest.Mocked<AdminDashboardRepository>;

  const cache = {
    invalidateAdminDashboard: jest.fn(),
  } as unknown as jest.Mocked<ProgressCacheService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips duplicate events', async () => {
    repository.hasProcessedEvent.mockResolvedValue(true);
    const useCase = new RecordDashboardEventUseCase(repository, cache);

    await useCase.execute({
      eventId: 'event-1',
      eventName: 'identity.user.created',
      activity: {
        eventId: 'event-1',
        type: 'student',
        title: 'Student created',
        description: 'identity.user.created',
        occurredAt: new Date('2026-06-01T00:00:00.000Z'),
      },
    });

    expect(repository.recordActivity).not.toHaveBeenCalled();
    expect(repository.markProcessedEvent).not.toHaveBeenCalled();
    expect(cache.invalidateAdminDashboard).not.toHaveBeenCalled();
  });

  it('records projection changes, marks processed event, and invalidates cache', async () => {
    repository.hasProcessedEvent.mockResolvedValue(false);
    const useCase = new RecordDashboardEventUseCase(repository, cache);
    const occurredAt = new Date('2026-06-01T00:00:00.000Z');

    await useCase.execute({
      eventId: 'event-2',
      eventName: 'identity.user.created',
      user: {
        userId: 'student-1',
        fullName: 'Student One',
        email: 'student@example.com',
        role: 'STUDENT',
        isActive: true,
        licenseTier: 'B2',
        createdAt: occurredAt,
        updatedAt: occurredAt,
      },
      activity: {
        eventId: 'event-2',
        type: 'student',
        title: 'Student created',
        description: 'identity.user.created',
        resourceType: 'USER',
        resourceId: 'student-1',
        occurredAt,
      },
    });

    expect(repository.upsertUserProjection).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'student-1', role: 'STUDENT' }),
    );
    expect(repository.recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'event-2' }),
    );
    expect(repository.markProcessedEvent).toHaveBeenCalledWith({
      eventId: 'event-2',
      eventName: 'identity.user.created',
    });
    expect(cache.invalidateAdminDashboard).toHaveBeenCalledTimes(1);
  });
});
