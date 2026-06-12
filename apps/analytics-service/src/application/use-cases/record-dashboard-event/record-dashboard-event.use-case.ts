import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { AdminDashboardRepository } from '../../../domain/repositories/admin-dashboard.repository';
import { ProgressCacheService } from '../../../infrastructure/cache/progress-cache.service';
import { RecordDashboardEventCommand } from './record-dashboard-event.command';

@Injectable()
export class RecordDashboardEventUseCase
  implements IUseCase<RecordDashboardEventCommand, void>
{
  constructor(
    private readonly repository: AdminDashboardRepository,
    private readonly cache: ProgressCacheService,
  ) {}

  async execute(command: RecordDashboardEventCommand): Promise<void> {
    if (await this.repository.hasProcessedEvent(command.eventId)) {
      return;
    }

    if ('user' in command && command.user) {
      await this.repository.upsertUserProjection(command.user);
    }
    if ('course' in command && command.course) {
      await this.repository.upsertCourseProjection(command.course);
    }
    if ('exam' in command && command.exam) {
      await this.repository.recordExamCompleted(command.exam);
    }
    if (command.activity) {
      await this.repository.recordActivity(command.activity);
    }

    await this.repository.markProcessedEvent({
      eventId: command.eventId,
      eventName: command.eventName,
    });
    await this.cache.invalidateAdminDashboard();
  }
}
