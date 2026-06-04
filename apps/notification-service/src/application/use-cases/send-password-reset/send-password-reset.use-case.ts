import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { NotificationDispatcher } from '../../services/notification-dispatcher.service';
import {
  NotificationRecord,
  NotificationType,
} from '../../../domain/repositories/notification.repository';
import { SendPasswordResetCommand } from './send-password-reset.command';

@Injectable()
export class SendPasswordResetUseCase
  implements IUseCase<SendPasswordResetCommand, NotificationRecord[]>
{
  constructor(private readonly dispatcher: NotificationDispatcher) {}

  async execute(
    command: SendPasswordResetCommand,
  ): Promise<NotificationRecord[]> {
    const body =
      'Bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu cho tài khoản này. ' +
      `Truy cập liên kết sau để tiếp tục: ${command.resetUrl}\n\n` +
      'Nếu không phải bạn, vui lòng bỏ qua email này.';
    return this.dispatcher.dispatch({
      eventType: 'identity.user.password-reset-requested',
      userId: command.userId,
      recipientEmail: command.email,
      title: 'Yêu cầu đặt lại mật khẩu',
      body,
      data: { resetUrl: command.resetUrl },
      channels: [NotificationType.EMAIL],
      retryCount: command.retryCount,
    });
  }
}
