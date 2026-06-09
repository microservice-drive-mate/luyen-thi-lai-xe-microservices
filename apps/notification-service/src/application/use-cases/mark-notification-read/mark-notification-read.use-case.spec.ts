import {
  NOTIFICATION_WS_EVENTS,
  WsEmitterPort,
} from '../../ports/ws-emitter.port';
import { NotificationNotFoundException } from '../../../domain/exceptions/notification-not-found.exception';
import {
  Notification,
  NotificationRecord,
  NotificationRepository,
  NotificationStatus,
  NotificationType,
} from '../../../domain/repositories/notification.repository';
import { MarkNotificationReadCommand } from './mark-notification-read.command';
import { MarkNotificationReadUseCase } from './mark-notification-read.use-case';

describe('MarkNotificationReadUseCase', () => {
  let repository: {
    findByUserAndId: jest.Mock;
    saveNotificationReadState: jest.Mock;
    countUnreadByUser: jest.Mock;
  };
  let wsEmitter: {
    emitToUser: jest.Mock;
  };
  let useCase: MarkNotificationReadUseCase;

  beforeEach(() => {
    repository = {
      findByUserAndId: jest.fn().mockResolvedValue(notificationRecord()),
      saveNotificationReadState: jest.fn((notification: Notification) =>
        Promise.resolve(notification.toSnapshot()),
      ),
      countUnreadByUser: jest.fn().mockResolvedValue(2),
    };
    wsEmitter = {
      emitToUser: jest.fn(),
    };
    useCase = new MarkNotificationReadUseCase(
      repository as unknown as NotificationRepository,
      wsEmitter as unknown as WsEmitterPort,
    );
  });

  it('marks a notification as read and emits the unread count', async () => {
    const result = await useCase.execute(
      new MarkNotificationReadCommand('notification-1', 'user-1'),
    );

    expect(result.isRead).toBe(true);
    expect(repository.countUnreadByUser).toHaveBeenCalledWith('user-1');
    expect(wsEmitter.emitToUser).toHaveBeenCalledWith(
      'user-1',
      NOTIFICATION_WS_EVENTS.UNREAD_COUNT_UPDATED,
      { unreadCount: 2 },
    );
  });

  it('throws when the notification does not belong to the user', async () => {
    repository.findByUserAndId.mockResolvedValue(null);

    await expect(
      useCase.execute(new MarkNotificationReadCommand('missing', 'user-1')),
    ).rejects.toBeInstanceOf(NotificationNotFoundException);
    expect(wsEmitter.emitToUser).not.toHaveBeenCalled();
  });
});

function notificationRecord(): NotificationRecord {
  const now = new Date('2026-06-08T00:00:00.000Z');
  return {
    id: 'notification-1',
    userId: 'user-1',
    type: NotificationType.IN_APP,
    eventType: 'course.updated',
    title: 'Course updated',
    body: 'Schedule changed',
    data: {},
    status: NotificationStatus.DELIVERED,
    retryCount: 0,
    errorMessage: null,
    isRead: false,
    readAt: null,
    sentAt: now,
    deliveredAt: now,
    createdAt: now,
    updatedAt: now,
  };
}
