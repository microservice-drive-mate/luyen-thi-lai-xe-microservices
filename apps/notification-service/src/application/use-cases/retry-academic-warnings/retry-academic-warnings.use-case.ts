import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import crypto from 'node:crypto';
import {
  AcademicWarning,
  Notification,
  NotificationRepository,
  NotificationType,
} from '../../../domain/repositories/notification.repository';
import { RetryAcademicWarningsCommand } from './retry-academic-warnings.command';

@Injectable()
export class RetryAcademicWarningsUseCase
  implements IUseCase<RetryAcademicWarningsCommand, number>
{
  constructor(private readonly repository: NotificationRepository) {}

  async execute(command = new RetryAcademicWarningsCommand()): Promise<number> {
    const warnings = await this.repository.findWarningsDueForRetry(
      new Date(),
      command.limit,
    );
    let queued = 0;

    for (const warning of warnings) {
      try {
        const now = new Date();
        const notification = await this.repository.createNotification(
          Notification.createDelivered(
            {
              id: crypto.randomUUID(),
              userId: warning.studentId,
              title: `Academic warning: ${warning.severity}`,
              body: warning.message,
              eventType: 'notification.academic-warning.retry',
              data: {
                warningId: warning.id,
                reason: warning.reason,
                severity: warning.severity,
              },
              type: NotificationType.IN_APP,
            },
            now,
          ),
        );
        const warningAggregate = AcademicWarning.reconstitute(warning);
        warningAggregate.markQueued(notification.id, now);
        await this.repository.saveAcademicWarningDelivery(warningAggregate);
        queued += 1;
      } catch (error) {
        const warningAggregate = AcademicWarning.reconstitute(warning);
        warningAggregate.recordRetryFailure((error as Error).message);
        await this.repository.saveAcademicWarningDelivery(warningAggregate);
      }
    }

    return queued;
  }
}
