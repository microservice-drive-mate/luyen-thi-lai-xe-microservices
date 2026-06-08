import { NotificationRecord } from '../../domain/repositories/notification.repository';

export const NOTIFICATION_WS_EVENTS = {
  CREATED: 'notification.created',
  UNREAD_COUNT_UPDATED: 'notification.unread_count.updated',
} as const;

export interface NotificationCreatedPayload {
  notification: NotificationRecord;
  unreadCount: number;
}

export interface NotificationUnreadCountPayload {
  unreadCount: number;
}

export function notificationUserRoom(userId: string): string {
  return `user:${userId}`;
}

export abstract class WsEmitterPort {
  abstract emitToUser<TPayload>(
    userId: string,
    event: string,
    payload: TPayload,
  ): void;
}

export abstract class WsServerBinderPort {
  abstract bindServer(server: unknown): void;
}
