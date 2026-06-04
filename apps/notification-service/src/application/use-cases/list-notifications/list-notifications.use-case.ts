import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import {
  NotificationRecord,
  NotificationRepository,
} from '../../../domain/repositories/notification.repository';
import { ListNotificationsQuery } from './list-notifications.query';

export interface ListNotificationsResult {
  items: NotificationRecord[];
  total: number;
  page: number;
  size: number;
}

@Injectable()
export class ListNotificationsUseCase
  implements IUseCase<ListNotificationsQuery, ListNotificationsResult>
{
  constructor(private readonly repository: NotificationRepository) {}

  async execute(
    query: ListNotificationsQuery,
  ): Promise<ListNotificationsResult> {
    const safePage = Math.max(query.page, 1);
    const safeSize = Math.min(Math.max(query.size, 1), 100);
    const result = await this.repository.findByUser(
      query.userId,
      safePage,
      safeSize,
    );
    return { ...result, page: safePage, size: safeSize };
  }
}
