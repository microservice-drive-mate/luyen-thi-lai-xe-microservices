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
      'Báº¡n (hoáº·c ai Ä‘Ã³) Ä‘Ã£ yÃªu cáº§u Ä‘áº·t láº¡i máº­t kháº©u cho tÃ i khoáº£n nÃ y. ' +
      `Truy cáº­p liÃªn káº¿t sau Ä‘á»ƒ tiáº¿p tá»¥c: ${command.resetUrl}\n\n` +
      'Náº¿u khÃ´ng pháº£i báº¡n, vui lÃ²ng bá» qua email nÃ y.';
    return this.dispatcher.dispatch({
      eventType: 'identity.user.password-reset-requested',
      userId: command.userId,
      recipientEmail: command.email,
      title: 'YÃªu cáº§u Ä‘áº·t láº¡i máº­t kháº©u',
      body,
      data: { resetUrl: command.resetUrl },
      channels: [NotificationType.EMAIL],
      retryCount: command.retryCount,
    });
  }
}
