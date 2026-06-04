import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import crypto from 'node:crypto';
import { NotificationDispatcher } from '../../services/notification-dispatcher.service';
import {
  AcademicWarning,
  AcademicWarningDeliveryStatus,
  AcademicWarningRecord,
  NotificationRecord,
  NotificationRepository,
  NotificationType,
} from '../../../domain/repositories/notification.repository';
import { SendAcademicWarningCommand } from './send-academic-warning.command';

export interface SendAcademicWarningResult {
  warning: AcademicWarningRecord;
  notifications: NotificationRecord[];
}

@Injectable()
export class SendAcademicWarningUseCase
  implements IUseCase<SendAcademicWarningCommand, SendAcademicWarningResult>
{
  constructor(
    private readonly dispatcher: NotificationDispatcher,
    private readonly repository: NotificationRepository,
  ) {}

  async execute(
    command: SendAcademicWarningCommand,
  ): Promise<SendAcademicWarningResult> {
    const warning = command.warningId
      ? AcademicWarning.reconstitute(this.reconstituteWarningSnapshot(command))
      : AcademicWarning.create({
          id: crypto.randomUUID(),
          studentId: command.studentId,
          reason: command.reason,
          severity: command.severity,
          message: command.message,
          createdById: command.createdById,
        });

    const warningRecord = command.warningId
      ? warning.toSnapshot()
      : await this.repository.createAcademicWarning(warning);

    const channels: NotificationType[] = [
      NotificationType.IN_APP,
      NotificationType.PUSH,
    ];
    if (command.studentEmail) channels.push(NotificationType.EMAIL);

    try {
      const notifications = await this.dispatcher.dispatch({
        eventType: 'notification.academic-warning.created',
        userId: command.studentId,
        recipientEmail: command.studentEmail,
        title: `Academic warning: ${command.severity}`,
        body: command.message,
        data: {
          warningId: warning.id,
          reason: command.reason,
          severity: command.severity,
        },
        channels,
        retryCount: command.retryCount,
      });

      warning.markQueued(notifications[0]?.id ?? null);
      const updatedWarning =
        await this.repository.saveAcademicWarningDelivery(warning);

      return { warning: updatedWarning, notifications };
    } catch (error) {
      warning.markPendingRetry(
        (error as Error).message,
        (command.retryCount ?? warningRecord.retryAttempts) + 1,
      );
      await this.repository.saveAcademicWarningDelivery(warning);
      throw error;
    }
  }

  private reconstituteWarningSnapshot(
    command: SendAcademicWarningCommand,
  ): AcademicWarningRecord {
    const now = new Date();
    return {
      id: command.warningId ?? '',
      studentId: command.studentId,
      reason: command.reason,
      severity: command.severity,
      message: command.message,
      createdById: command.createdById,
      deliveryStatus: AcademicWarningDeliveryStatus.PENDING,
      retryAttempts: command.retryCount ?? 0,
      nextRetryAt: null,
      notificationId: null,
      lastError: null,
      queuedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }
}
