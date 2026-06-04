import { DeviceToken } from './device-token.entity';

describe('DeviceToken', () => {
  it('creates a registration snapshot with an application-provided id', () => {
    const token = DeviceToken.register(
      {
        id: 'device-token-1',
        userId: 'user-1',
        token: 'fcm-token',
        platform: 'android',
      },
      new Date('2026-06-04T00:00:00.000Z'),
    );

    expect(token.toSnapshot()).toMatchObject({
      id: 'device-token-1',
      userId: 'user-1',
      token: 'fcm-token',
      platform: 'android',
    });
  });
});
