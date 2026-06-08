import { Injectable } from '@nestjs/common';
import {
  NotificationStatus as PrismaNotificationStatus,
  NotificationType as PrismaNotificationType,
  Prisma,
} from '@prisma/notification-client';
import {
  AcademicWarningDeliveryStatus,
  AcademicWarningRecord,
  AcademicWarning,
  Notification,
  NotificationRecord,
  NotificationRepository,
  NotificationStatus,
  NotificationType,
} from '../../../domain/repositories/notification.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaNotificationRepository extends NotificationRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async createNotification(
    notification: Notification,
  ): Promise<NotificationRecord> {
    const snapshot = notification.toSnapshot();
    const record = await this.prisma.notification.create({
      data: {
        id: snapshot.id,
        userId: snapshot.userId,
        title: snapshot.title,
        body: snapshot.body,
        type: snapshot.type as PrismaNotificationType,
        eventType: snapshot.eventType,
        data: snapshot.data as Prisma.InputJsonValue,
        status: snapshot.status as PrismaNotificationStatus,
        retryCount: snapshot.retryCount,
        errorMessage: snapshot.errorMessage,
        sentAt: snapshot.sentAt,
        deliveredAt: snapshot.deliveredAt,
        isRead: snapshot.isRead,
        readAt: snapshot.readAt,
      },
    });
    return this.mapNotification(record);
  }

  async createAcademicWarning(
    warning: AcademicWarning,
  ): Promise<AcademicWarningRecord> {
    const snapshot = warning.toSnapshot();
    const record = await this.prisma.academicWarning.create({
      data: {
        id: snapshot.id,
        studentId: snapshot.studentId,
        reason: snapshot.reason,
        severity: snapshot.severity,
        message: snapshot.message,
        createdById: snapshot.createdById,
        deliveryStatus: snapshot.deliveryStatus as never,
        retryAttempts: snapshot.retryAttempts,
        nextRetryAt: snapshot.nextRetryAt,
        notificationId: snapshot.notificationId,
        lastError: snapshot.lastError,
        queuedAt: snapshot.queuedAt,
      },
    });
    return this.mapAcademicWarning(record);
  }

  async saveAcademicWarningDelivery(
    warning: AcademicWarning,
  ): Promise<AcademicWarningRecord> {
    const snapshot = warning.toSnapshot();
    const record = await this.prisma.academicWarning.update({
      where: { id: snapshot.id },
      data: {
        deliveryStatus: snapshot.deliveryStatus as never,
        notificationId: snapshot.notificationId,
        lastError: snapshot.lastError,
        queuedAt: snapshot.queuedAt,
        nextRetryAt: snapshot.nextRetryAt,
        retryAttempts: snapshot.retryAttempts,
      },
    });
    return this.mapAcademicWarning(record);
  }

  async findWarningsDueForRetry(
    now: Date,
    take: number,
  ): Promise<AcademicWarningRecord[]> {
    const records = await this.prisma.academicWarning.findMany({
      where: {
        deliveryStatus: AcademicWarningDeliveryStatus.PENDING_RETRY as never,
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take,
    });
    return records.map((record) => this.mapAcademicWarning(record));
  }

  async findByUser(
    userId: string,
    page: number,
    size: number,
  ): Promise<{ items: NotificationRecord[]; total: number }> {
    const skip = (page - 1) * size;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: size,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return { items: items.map((item) => this.mapNotification(item)), total };
  }

  async findByUserAndId(
    id: string,
    userId: string,
  ): Promise<NotificationRecord | null> {
    const record = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    return record ? this.mapNotification(record) : null;
  }

  async countUnreadByUser(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  async saveNotificationReadState(
    notification: Notification,
  ): Promise<NotificationRecord> {
    const snapshot = notification.toSnapshot();
    const record = await this.prisma.notification.update({
      where: { id: snapshot.id },
      data: {
        isRead: snapshot.isRead,
        readAt: snapshot.readAt,
      },
    });
    return this.mapNotification(record);
  }

  async saveNotificationDelivery(
    notification: Notification,
  ): Promise<NotificationRecord> {
    const snapshot = notification.toSnapshot();
    const record = await this.prisma.notification.update({
      where: { id: snapshot.id },
      data: {
        status: snapshot.status as PrismaNotificationStatus,
        retryCount: snapshot.retryCount,
        errorMessage: snapshot.errorMessage,
        deliveredAt: snapshot.deliveredAt,
        sentAt: snapshot.sentAt,
      },
    });
    return this.mapNotification(record);
  }

  private mapNotification(record: {
    id: string;
    userId: string;
    type: unknown;
    eventType: string | null;
    title: string;
    body: string;
    data: unknown;
    status: unknown;
    retryCount: number;
    errorMessage: string | null;
    isRead: boolean;
    readAt: Date | null;
    sentAt: Date | null;
    deliveredAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): NotificationRecord {
    return {
      ...record,
      type: record.type as NotificationType,
      status: record.status as NotificationStatus,
    };
  }

  private mapAcademicWarning(record: {
    id: string;
    studentId: string;
    reason: string;
    severity: string;
    message: string;
    createdById: string;
    deliveryStatus: unknown;
    retryAttempts: number;
    nextRetryAt: Date | null;
    notificationId: string | null;
    lastError: string | null;
    queuedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): AcademicWarningRecord {
    return {
      ...record,
      deliveryStatus: record.deliveryStatus as AcademicWarningDeliveryStatus,
    };
  }
}
