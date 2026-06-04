import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { NotificationDispatcher } from '../../services/notification-dispatcher.service';
import {
  NotificationRecord,
  NotificationType,
} from '../../../domain/repositories/notification.repository';
import { SendCourseUpdateCommand } from './send-course-update.command';

@Injectable()
export class SendCourseUpdateUseCase
  implements IUseCase<SendCourseUpdateCommand, NotificationRecord[]>
{
  constructor(private readonly dispatcher: NotificationDispatcher) {}

  async execute(
    command: SendCourseUpdateCommand,
  ): Promise<NotificationRecord[]> {
    const channels: NotificationType[] = [
      NotificationType.IN_APP,
      NotificationType.PUSH,
    ];
    if (command.email) channels.push(NotificationType.EMAIL);
    return this.dispatcher.dispatch({
      eventType: 'course.updated',
      userId: command.userId,
      recipientEmail: command.email,
      title: `Cáº­p nháº­t khÃ³a há»c: ${command.courseTitle}`,
      body: command.updateSummary,
      data: {
        courseId: command.courseId,
        courseTitle: command.courseTitle,
      },
      channels,
      retryCount: command.retryCount,
    });
  }
}
