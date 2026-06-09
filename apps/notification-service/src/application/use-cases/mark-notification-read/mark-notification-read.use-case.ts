import { Injectable, Logger } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import {
  NOTIFICATION_WS_EVENTS,
  NotificationUnreadCountPayload,
  WsEmitterPort,
} from '../../ports/ws-emitter.port';
import { NotificationNotFoundException } from '../../../domain/exceptions/notification-not-found.exception';
import {
  Notification,
  NotificationRecord,
  NotificationRepository,
} from '../../../domain/repositories/notification.repository';
import { MarkNotificationReadCommand } from './mark-notification-read.command';

@Injectable()
export class MarkNotificationReadUseCase
  implements IUseCase<MarkNotificationReadCommand, NotificationRecord>
{
  private readonly logger = new Logger(MarkNotificationReadUseCase.name);

  constructor(
    private readonly repository: NotificationRepository,
    private readonly wsEmitter: WsEmitterPort,
  ) {}

  async execute(
    command: MarkNotificationReadCommand,
  ): Promise<NotificationRecord> {
    const record = await this.repository.findByUserAndId(
      command.notificationId,
      command.userId,
    );
    if (!record)
      throw new NotificationNotFoundException(command.notificationId);

    const notification = Notification.reconstitute(record);
    notification.markRead();
    const saved = await this.repository.saveNotificationReadState(notification);
    await this.emitUnreadCount(command.userId);
    return saved;
  }

  private async emitUnreadCount(userId: string): Promise<void> {
    try {
      const unreadCount = await this.repository.countUnreadByUser(userId);
      const payload: NotificationUnreadCountPayload = { unreadCount };
      this.wsEmitter.emitToUser(
        userId,
        NOTIFICATION_WS_EVENTS.UNREAD_COUNT_UPDATED,
        payload,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown websocket error';
      this.logger.warn(
        `Unable to emit unread notification count for ${userId}: ${message}`,
      );
    }
  }
}
