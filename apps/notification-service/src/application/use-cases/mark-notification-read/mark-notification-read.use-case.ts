import { Injectable, NotFoundException } from '@nestjs/common';
import { IUseCase } from '@repo/common';
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
  constructor(private readonly repository: NotificationRepository) {}

  async execute(
    command: MarkNotificationReadCommand,
  ): Promise<NotificationRecord> {
    const record = await this.repository.findByUserAndId(
      command.notificationId,
      command.userId,
    );
    if (!record) throw new NotFoundException('Notification not found');

    const notification = Notification.reconstitute(record);
    notification.markRead();
    return this.repository.saveNotificationReadState(notification);
  }
}
