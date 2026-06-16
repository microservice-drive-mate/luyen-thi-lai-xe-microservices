import {
  Notification,
  NotificationRepository,
  NotificationStatus,
  NotificationType,
} from '../../domain/repositories/notification.repository';
import { DeviceTokenRepository } from '../../domain/repositories/device-token.repository';
import { NotificationMetrics } from '../../infrastructure/metrics/notification.metrics';
import { PushSendResult } from '../ports/push.provider';
import { NOTIFICATION_WS_EVENTS } from '../ports/ws-emitter.port';
import { NotificationDispatcher } from './notification-dispatcher.service';

describe('NotificationDispatcher push delivery', () => {
  const baseInput = {
    eventType: 'course.updated',
    userId: 'user-1',
    title: 'Course updated',
    body: 'Schedule changed',
    channels: [NotificationType.PUSH],
  };

  let notificationRepository: {
    createNotification: jest.Mock;
    saveNotificationDelivery: jest.Mock;
    countUnreadByUser: jest.Mock;
  };
  let deviceTokenRepository: {
    findByUser: jest.Mock;
    deleteManyTokens: jest.Mock;
  };
  let pushProvider: {
    sendToTokens: jest.Mock;
  };
  let metrics: {
    recordSuccess: jest.Mock;
    recordFailure: jest.Mock;
    recordSkipped: jest.Mock;
  };
  let wsEmitter: {
    emitToUser: jest.Mock;
  };
  let dispatcher: NotificationDispatcher;

  beforeEach(() => {
    notificationRepository = {
      createNotification: jest.fn((notification: Notification) =>
        Promise.resolve(notification.toSnapshot()),
      ),
      saveNotificationDelivery: jest.fn((notification: Notification) =>
        Promise.resolve(notification.toSnapshot()),
      ),
      countUnreadByUser: jest.fn().mockResolvedValue(3),
    };
    deviceTokenRepository = {
      findByUser: jest.fn(),
      deleteManyTokens: jest.fn().mockResolvedValue(undefined),
    };
    pushProvider = {
      sendToTokens: jest.fn(),
    };
    metrics = {
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
      recordSkipped: jest.fn(),
    };
    wsEmitter = {
      emitToUser: jest.fn(),
    };

    dispatcher = new NotificationDispatcher(
      notificationRepository as unknown as NotificationRepository,
      deviceTokenRepository as unknown as DeviceTokenRepository,
      { send: jest.fn() },
      pushProvider,
      metrics as unknown as NotificationMetrics,
      wsEmitter,
    );
  });

  it('emits realtime events for delivered in-app notifications', async () => {
    const result = await dispatcher.dispatch({
      ...baseInput,
      channels: [NotificationType.IN_APP],
    });

    expect(result[0]).toMatchObject({
      type: NotificationType.IN_APP,
      status: NotificationStatus.DELIVERED,
    });
    expect(notificationRepository.countUnreadByUser).toHaveBeenCalledWith(
      'user-1',
    );
    expect(wsEmitter.emitToUser).toHaveBeenCalledWith(
      'user-1',
      NOTIFICATION_WS_EVENTS.CREATED,
      {
        notification: result[0],
        unreadCount: 3,
      },
    );
    expect(wsEmitter.emitToUser).toHaveBeenCalledWith(
      'user-1',
      NOTIFICATION_WS_EVENTS.UNREAD_COUNT_UPDATED,
      { unreadCount: 3 },
    );
  });

  it('skips push without retry when the user has no device tokens', async () => {
    deviceTokenRepository.findByUser.mockResolvedValue([]);

    const result = await dispatcher.dispatch(baseInput);

    expect(result[0]).toMatchObject({
      type: NotificationType.PUSH,
      status: NotificationStatus.DELIVERED,
    });
    expect(pushProvider.sendToTokens).not.toHaveBeenCalled();
    expect(metrics.recordSkipped).toHaveBeenCalledWith(
      NotificationType.PUSH,
      'course.updated',
    );
    expect(metrics.recordFailure).not.toHaveBeenCalled();
  });

  it('skips push without retry when FCM is disabled', async () => {
    deviceTokenRepository.findByUser.mockResolvedValue([
      deviceToken('token-1'),
    ]);
    pushProvider.sendToTokens.mockResolvedValue(
      pushResult({ skippedCount: 1 }),
    );

    const result = await dispatcher.dispatch(baseInput);

    expect(result[0].status).toBe(NotificationStatus.DELIVERED);
    expect(metrics.recordSkipped).toHaveBeenCalledWith(
      NotificationType.PUSH,
      'course.updated',
    );
    expect(metrics.recordFailure).not.toHaveBeenCalled();
  });

  it('deletes invalid tokens and skips without retry when all failures are non-retryable', async () => {
    deviceTokenRepository.findByUser.mockResolvedValue([
      deviceToken('bad-token-1'),
      deviceToken('bad-token-2'),
    ]);
    pushProvider.sendToTokens.mockResolvedValue(
      pushResult({
        failureCount: 2,
        invalidTokens: ['bad-token-1', 'bad-token-2'],
      }),
    );

    const result = await dispatcher.dispatch(baseInput);

    expect(result[0].status).toBe(NotificationStatus.DELIVERED);
    expect(deviceTokenRepository.deleteManyTokens).toHaveBeenCalledWith([
      'bad-token-1',
      'bad-token-2',
    ]);
    expect(metrics.recordSkipped).toHaveBeenCalledWith(
      NotificationType.PUSH,
      'course.updated',
    );
  });

  it('marks failed and throws when every push attempt has retryable errors', async () => {
    deviceTokenRepository.findByUser.mockResolvedValue([
      deviceToken('token-1'),
    ]);
    pushProvider.sendToTokens.mockResolvedValue(
      pushResult({ failureCount: 1, retryableFailureCount: 1 }),
    );

    await expect(dispatcher.dispatch(baseInput)).rejects.toThrow(
      'All push delivery attempts failed with retryable errors',
    );

    const calls = notificationRepository.saveNotificationDelivery.mock
      .calls as unknown[][];
    const saved = calls[0][0] as Notification;
    expect(saved.toSnapshot()).toMatchObject({
      status: NotificationStatus.FAILED,
    });
    expect(metrics.recordFailure).toHaveBeenCalledWith(
      NotificationType.PUSH,
      'course.updated',
    );
  });

  it('treats partial push success as delivered', async () => {
    deviceTokenRepository.findByUser.mockResolvedValue([
      deviceToken('token-1'),
      deviceToken('token-2'),
    ]);
    pushProvider.sendToTokens.mockResolvedValue(
      pushResult({
        successCount: 1,
        failureCount: 1,
        retryableFailureCount: 1,
      }),
    );

    const result = await dispatcher.dispatch(baseInput);

    expect(result[0].status).toBe(NotificationStatus.DELIVERED);
    expect(metrics.recordSuccess).toHaveBeenCalledWith(
      NotificationType.PUSH,
      'course.updated',
    );
    expect(metrics.recordFailure).not.toHaveBeenCalled();
  });
});

function deviceToken(token: string) {
  return {
    id: `device-${token}`,
    userId: 'user-1',
    token,
    platform: 'android',
    createdAt: new Date('2026-06-04T00:00:00.000Z'),
    updatedAt: new Date('2026-06-04T00:00:00.000Z'),
  };
}

function pushResult(overrides: Partial<PushSendResult>): PushSendResult {
  return {
    successCount: 0,
    failureCount: 0,
    skippedCount: 0,
    retryableFailureCount: 0,
    invalidTokens: [],
    ...overrides,
  };
}
