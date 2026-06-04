import {
  Notification,
  NotificationStatus,
  NotificationType,
} from './notification.aggregate';

describe('Notification', () => {
  it('tracks delivery and read state transitions', () => {
    const notification = Notification.createQueued(
      {
        id: 'notification-1',
        userId: 'user-1',
        title: 'Title',
        body: 'Body',
        type: NotificationType.IN_APP,
      },
      new Date('2026-06-04T00:00:00.000Z'),
    );

    notification.markDelivered(new Date('2026-06-04T01:00:00.000Z'));
    notification.markRead(new Date('2026-06-04T02:00:00.000Z'));

    expect(notification.toSnapshot()).toMatchObject({
      id: 'notification-1',
      status: NotificationStatus.DELIVERED,
      isRead: true,
      deliveredAt: new Date('2026-06-04T01:00:00.000Z'),
      readAt: new Date('2026-06-04T02:00:00.000Z'),
    });
  });

  it('captures delivery failure details', () => {
    const notification = Notification.createQueued({
      id: 'notification-1',
      userId: 'user-1',
      title: 'Title',
      body: 'Body',
    });

    notification.markFailed('provider unavailable');

    expect(notification.toSnapshot()).toMatchObject({
      status: NotificationStatus.FAILED,
      errorMessage: 'provider unavailable',
    });
  });
});
