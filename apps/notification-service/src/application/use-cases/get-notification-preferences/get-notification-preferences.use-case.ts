import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

export interface NotificationPreferencesResult {
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  studyReminderEnabled: boolean;
  examReminderEnabled: boolean;
  courseUpdateEnabled: boolean;
  academicWarningEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class GetNotificationPreferencesUseCase
  implements IUseCase<string, NotificationPreferencesResult>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string): Promise<NotificationPreferencesResult> {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }
}
