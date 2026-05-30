import { Injectable } from '@nestjs/common';
import {
  AcademicWarningDeliveryStatus,
  NotificationRecord,
  NotificationRepository,
} from '../../domain/repositories/notification.repository';

export interface AcademicWarningDispatchResult {
  warningId: string;
  warningIds: string[];
  notification: NotificationRecord | null;
  notifications: NotificationRecord[];
  deliveryStatus: AcademicWarningDeliveryStatus;
  persisted: number;
  queued: number;
  pendingRetry: number;
}

@Injectable()
export class SendAcademicWarningUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  async execute(input: {
    studentId: string;
    reason: string;
    severity: string;
    message: string;
    createdById: string;
  }): Promise<AcademicWarningDispatchResult> {
    const warning = await this.repository.createAcademicWarning(input);
    try {
      const notification = await this.createWarningNotification(
        input,
        warning.id,
      );
      await this.repository.updateAcademicWarningDelivery(warning.id, {
        deliveryStatus: AcademicWarningDeliveryStatus.QUEUED,
        notificationId: notification.id,
        queuedAt: new Date(),
        nextRetryAt: null,
        lastError: null,
      });
      return {
        warningId: warning.id,
        warningIds: [warning.id],
        notification,
        notifications: [notification],
        deliveryStatus: AcademicWarningDeliveryStatus.QUEUED,
        persisted: 1,
        queued: 1,
        pendingRetry: 0,
      };
    } catch (error) {
      const nextRetryAt = new Date(Date.now() + 5 * 60_000);
      await this.repository.updateAcademicWarningDelivery(warning.id, {
        deliveryStatus: AcademicWarningDeliveryStatus.PENDING_RETRY,
        lastError: (error as Error).message,
        nextRetryAt,
      });
      return {
        warningId: warning.id,
        warningIds: [warning.id],
        notification: null,
        notifications: [],
        deliveryStatus: AcademicWarningDeliveryStatus.PENDING_RETRY,
        persisted: 1,
        queued: 0,
        pendingRetry: 1,
      };
    }
  }

  async executeMany(input: {
    studentIds: string[];
    reason: string;
    severity: string;
    message: string;
    createdById: string;
  }): Promise<AcademicWarningDispatchResult> {
    const results: AcademicWarningDispatchResult[] = [];
    for (const studentId of input.studentIds) {
      results.push(
        await this.execute({
          studentId,
          reason: input.reason,
          severity: input.severity,
          message: input.message,
          createdById: input.createdById,
        }),
      );
    }

    const warningIds = results.flatMap((result) => result.warningIds);
    const notifications = results.flatMap((result) => result.notifications);
    const pendingRetry = results.reduce(
      (total, result) => total + result.pendingRetry,
      0,
    );

    return {
      warningId: warningIds[0] ?? '',
      warningIds,
      notification: notifications[0] ?? null,
      notifications,
      deliveryStatus:
        pendingRetry > 0
          ? AcademicWarningDeliveryStatus.PENDING_RETRY
          : AcademicWarningDeliveryStatus.QUEUED,
      persisted: results.reduce((total, result) => total + result.persisted, 0),
      queued: results.reduce((total, result) => total + result.queued, 0),
      pendingRetry,
    };
  }

  private createWarningNotification(
    input: {
      studentId: string;
      reason: string;
      severity: string;
      message: string;
    },
    warningId: string,
  ): Promise<NotificationRecord> {
    return this.repository.createNotification({
      userId: input.studentId,
      title: `Academic warning: ${input.severity}`,
      body: input.message,
      data: {
        warningId,
        reason: input.reason,
        severity: input.severity,
      },
      sentAt: new Date(),
    });
  }
}

@Injectable()
export class RetryAcademicWarningsUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  async execute(limit = 20): Promise<number> {
    const warnings = await this.repository.findWarningsDueForRetry(
      new Date(),
      limit,
    );
    let queued = 0;
    for (const warning of warnings) {
      try {
        const notification = await this.repository.createNotification({
          userId: warning.studentId,
          title: `Academic warning: ${warning.severity}`,
          body: warning.message,
          data: {
            warningId: warning.id,
            reason: warning.reason,
            severity: warning.severity,
          },
          sentAt: new Date(),
        });
        await this.repository.updateAcademicWarningDelivery(warning.id, {
          deliveryStatus: AcademicWarningDeliveryStatus.QUEUED,
          notificationId: notification.id,
          queuedAt: new Date(),
          nextRetryAt: null,
          lastError: null,
        });
        queued += 1;
      } catch (error) {
        const attempts = warning.retryAttempts + 1;
        await this.repository.updateAcademicWarningDelivery(warning.id, {
          deliveryStatus:
            attempts >= 3
              ? AcademicWarningDeliveryStatus.FAILED
              : AcademicWarningDeliveryStatus.PENDING_RETRY,
          retryAttempts: attempts,
          lastError: (error as Error).message,
          nextRetryAt: attempts >= 3 ? null : new Date(Date.now() + 5 * 60_000),
        });
      }
    }
    return queued;
  }
}

@Injectable()
export class ListNotificationsUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  async execute(
    userId: string,
    page: number,
    size: number,
  ): Promise<{
    items: NotificationRecord[];
    total: number;
    page: number;
    size: number;
  }> {
    const safePage = Math.max(page, 1);
    const safeSize = Math.min(Math.max(size, 1), 100);
    const result = await this.repository.findByUser(userId, safePage, safeSize);
    return { ...result, page: safePage, size: safeSize };
  }
}

@Injectable()
export class MarkNotificationReadUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  async execute(id: string, userId: string): Promise<NotificationRecord> {
    return this.repository.markRead(id, userId);
  }
}
