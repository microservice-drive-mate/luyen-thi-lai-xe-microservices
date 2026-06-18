import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import {
  NotificationRecord,
  NotificationType,
} from '../../../domain/repositories/notification.repository';
import { NotificationDispatcher } from '../../services/notification-dispatcher.service';
import { SendExamResultCommand } from './send-exam-result.command';

@Injectable()
export class SendExamResultUseCase
  implements IUseCase<SendExamResultCommand, NotificationRecord[]>
{
  constructor(private readonly dispatcher: NotificationDispatcher) {}

  async execute(command: SendExamResultCommand): Promise<NotificationRecord[]> {
    const isPassed = command.eventType === 'exam.session.passed';
    const title = isPassed ? 'Bạn đã vượt qua bài thi' : 'Bài thi chưa đạt';
    const body = isPassed
      ? `Chúc mừng! Bạn đã hoàn thành bài thi ${command.licenseCategory ?? ''}. ${
          typeof command.score === 'number' ? `Điểm: ${command.score}.` : ''
        }`.trim()
      : 'Hãy ôn lại các nhóm câu hỏi thường sai và làm thêm bài luyện đề.';
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
