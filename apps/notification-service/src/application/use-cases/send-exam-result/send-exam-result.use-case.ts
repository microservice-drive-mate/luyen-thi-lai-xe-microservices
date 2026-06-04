import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { NotificationDispatcher } from '../../services/notification-dispatcher.service';
import {
  NotificationRecord,
  NotificationType,
} from '../../../domain/repositories/notification.repository';
import { SendExamResultCommand } from './send-exam-result.command';

@Injectable()
export class SendExamResultUseCase
  implements IUseCase<SendExamResultCommand, NotificationRecord[]>
{
  constructor(private readonly dispatcher: NotificationDispatcher) {}

  async execute(command: SendExamResultCommand): Promise<NotificationRecord[]> {
    const isPassed = command.eventType === 'exam.session.passed';
    const title = isPassed
      ? 'Báº¡n Ä‘Ã£ vÆ°á»£t qua bÃ i thi'
      : 'BÃ i thi chÆ°a Ä‘áº¡t';
    const body = isPassed
      ? `ChÃºc má»«ng! Báº¡n Ä‘Ã£ hoÃ n thÃ nh bÃ i thi ${command.licenseCategory ?? ''}. ${
          typeof command.score === 'number' ? `Äiá»ƒm: ${command.score}.` : ''
        }`.trim()
      : 'HÃ£y Ã´n láº¡i cÃ¡c nhÃ³m cÃ¢u há»i thÆ°á»ng sai vÃ  lÃ m thÃªm bÃ i luyá»‡n Ä‘á».';
    const channels: NotificationType[] = [
      NotificationType.IN_APP,
      NotificationType.PUSH,
    ];
    if (command.email) channels.push(NotificationType.EMAIL);
    return this.dispatcher.dispatch({
      eventType: command.eventType,
      userId: command.userId,
      recipientEmail: command.email,
      title,
      body,
      data: {
        sessionId: command.sessionId ?? '',
        licenseCategory: command.licenseCategory ?? '',
        score: command.score ?? null,
        passed: isPassed,
      },
      channels,
      retryCount: command.retryCount,
    });
  }
}
