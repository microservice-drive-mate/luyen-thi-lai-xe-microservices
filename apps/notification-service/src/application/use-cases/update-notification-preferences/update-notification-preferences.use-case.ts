import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { NotificationPreferencesResult } from '../get-notification-preferences/get-notification-preferences.use-case';
import { UpdateNotificationPreferencesCommand } from './update-notification-preferences.command';

@Injectable()
export class UpdateNotificationPreferencesUseCase
  implements
    IUseCase<
      UpdateNotificationPreferencesCommand,
      NotificationPreferencesResult
    >
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    command: UpdateNotificationPreferencesCommand,
  ): Promise<NotificationPreferencesResult> {
    return this.prisma.notificationPreference.upsert({
      where: { userId: command.userId },
      create: {
        userId: command.userId,
        inAppEnabled: command.inAppEnabled ?? true,
        emailEnabled: command.emailEnabled ?? true,
        pushEnabled: command.pushEnabled ?? false,
        smsEnabled: command.smsEnabled ?? false,
        studyReminderEnabled: command.studyReminderEnabled ?? true,
        examReminderEnabled: command.examReminderEnabled ?? true,
        courseUpdateEnabled: command.courseUpdateEnabled ?? true,
        academicWarningEnabled: command.academicWarningEnabled ?? true,
      },
      update: {
        inAppEnabled: command.inAppEnabled,
        emailEnabled: command.emailEnabled,
        pushEnabled: command.pushEnabled,
        smsEnabled: command.smsEnabled,
        studyReminderEnabled: command.studyReminderEnabled,
        examReminderEnabled: command.examReminderEnabled,
        courseUpdateEnabled: command.courseUpdateEnabled,
        academicWarningEnabled: command.academicWarningEnabled,
      },
    });
  }
}
