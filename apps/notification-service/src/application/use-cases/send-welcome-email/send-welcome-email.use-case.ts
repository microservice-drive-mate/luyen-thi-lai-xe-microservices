import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import {
  NotificationRecord,
  NotificationType,
} from '../../../domain/repositories/notification.repository';
import { NotificationDispatcher } from '../../services/notification-dispatcher.service';
import { SendWelcomeEmailCommand } from './send-welcome-email.command';

@Injectable()
export class SendWelcomeEmailUseCase
  implements IUseCase<SendWelcomeEmailCommand, NotificationRecord[]>
{
  constructor(private readonly dispatcher: NotificationDispatcher) {}

  async execute(
    command: SendWelcomeEmailCommand,
  ): Promise<NotificationRecord[]> {
    const greeting = command.fullName
      ? `Xin chào ${command.fullName},`
      : 'Xin chào,';
    const body =
      `${greeting}\n\n` +
      'Chúc mừng bạn đã tham gia hệ thống Luyện thi lái xe. ' +
      'Bạn có thể bắt đầu các khóa học và làm bài luyện đề ngay bây giờ.';
    return this.dispatcher.dispatch({
      eventType: 'identity.user.created',
      userId: command.userId,
      recipientEmail: command.email,
      title: 'Chào mừng đến với Luyện thi lái xe',
      body,
      data: { email: command.email },
      channels: [NotificationType.IN_APP, NotificationType.EMAIL],
      retryCount: command.retryCount,
    });
  }
}
