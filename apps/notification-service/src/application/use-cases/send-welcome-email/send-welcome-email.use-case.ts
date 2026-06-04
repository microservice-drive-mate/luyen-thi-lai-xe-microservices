import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { NotificationDispatcher } from '../../services/notification-dispatcher.service';
import {
  NotificationRecord,
  NotificationType,
} from '../../../domain/repositories/notification.repository';
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
      ? `Xin chÃ o ${command.fullName},`
      : 'Xin chÃ o,';
    const body =
      `${greeting}\n\n` +
      'ChÃºc má»«ng báº¡n Ä‘Ã£ tham gia há»‡ thá»‘ng Luyá»‡n thi lÃ¡i xe. ' +
      'Báº¡n cÃ³ thá»ƒ báº¯t Ä‘áº§u cÃ¡c khÃ³a há»c vÃ  lÃ m bÃ i luyá»‡n Ä‘á» ngay bÃ¢y giá».';
    return this.dispatcher.dispatch({
      eventType: 'identity.user.created',
      userId: command.userId,
      recipientEmail: command.email,
      title: 'ChÃ o má»«ng Ä‘áº¿n vá»›i Luyá»‡n thi lÃ¡i xe',
      body,
      data: { email: command.email },
      channels: [NotificationType.IN_APP, NotificationType.EMAIL],
      retryCount: command.retryCount,
    });
  }
}
