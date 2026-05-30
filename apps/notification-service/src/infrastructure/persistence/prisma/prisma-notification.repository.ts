import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/notification-client';
import {
  AcademicWarningRecord,
  AcademicWarningDeliveryStatus,
  NotificationRecord,
  NotificationRepository,
} from '../../../domain/repositories/notification.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaNotificationRepository extends NotificationRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async createNotification(input: {
    userId: string;
    title: string;
    body: string;
    data?: unknown;
    type?: NotificationType;
    sentAt?: Date;
  }): Promise<NotificationRecord> {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        body: input.body,
        type: input.type ?? NotificationType.IN_APP,
        data: (input.data ?? {}) as Prisma.InputJsonValue,
        sentAt: input.sentAt ?? new Date(),
      },
    });
  }

  async createAcademicWarning(input: {
    studentId: string;
    reason: string;
    severity: string;
    message: string;
    createdById: string;
  }): Promise<AcademicWarningRecord> {
    const record = await this.prisma.academicWarning.create({ data: input });
    return {
      ...record,
      deliveryStatus:
        record.deliveryStatus as unknown as AcademicWarningDeliveryStatus,
    };
  }

  async updateAcademicWarningDelivery(
    id: string,
    input: {
      deliveryStatus: AcademicWarningDeliveryStatus;
      notificationId?: string | null;
      lastError?: string | null;
      queuedAt?: Date | null;
      nextRetryAt?: Date | null;
      retryAttempts?: number;
    },
  ): Promise<AcademicWarningRecord> {
    const record = await this.prisma.academicWarning.update({
      where: { id },
      data: {
        deliveryStatus: input.deliveryStatus as never,
        notificationId: input.notificationId,
        lastError: input.lastError,
        queuedAt: input.queuedAt,
        nextRetryAt: input.nextRetryAt,
        ...(input.retryAttempts !== undefined && {
          retryAttempts: input.retryAttempts,
        }),
      },
    });
    return {
      ...record,
      deliveryStatus:
        record.deliveryStatus as unknown as AcademicWarningDeliveryStatus,
    };
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
    return records.map((record) => ({
      ...record,
      deliveryStatus:
        record.deliveryStatus as unknown as AcademicWarningDeliveryStatus,
    }));
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
    return { items, total };
  }

  async markRead(id: string, userId: string): Promise<NotificationRecord> {
    const item = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!item) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
