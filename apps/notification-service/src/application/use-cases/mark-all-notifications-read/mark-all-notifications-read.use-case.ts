import { Injectable, Logger } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import {
  NOTIFICATION_WS_EVENTS,
  NotificationUnreadCountPayload,
  WsEmitterPort,
} from '../../ports/ws-emitter.port';
import { NotificationRepository } from '../../../domain/repositories/notification.repository';
import { MarkAllNotificationsReadCommand } from './mark-all-notifications-read.command';

@Injectable()
export class MarkAllNotificationsReadUseCase
  implements IUseCase<MarkAllNotificationsReadCommand, { updated: number }>
{
  private readonly logger = new Logger(MarkAllNotificationsReadUseCase.name);

  constructor(
    private readonly repository: NotificationRepository,
    private readonly wsEmitter: WsEmitterPort,
  ) {}

  async execute(
    command: MarkAllNotificationsReadCommand,
  ): Promise<{ updated: number }> {
    const updated = await this.repository.markAllReadByUser(command.userId);
    await this.emitUnreadCount(command.userId);
    return { updated };
  }

  private async emitUnreadCount(userId: string): Promise<void> {
    try {
      const payload: NotificationUnreadCountPayload = { unreadCount: 0 };
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
