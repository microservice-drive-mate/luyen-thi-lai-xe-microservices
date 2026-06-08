const mockApps: unknown[] = [];
const mockApp = { name: 'mock-firebase-app' };
const mockSendEachForMulticast = jest.fn();
const mockMessaging = jest.fn(() => ({
  sendEachForMulticast: mockSendEachForMulticast,
}));
const mockInitializeApp = jest.fn(() => mockApp);
const mockAppGetter = jest.fn(() => mockApp);
const mockCert = jest.fn((value: unknown) => ({ value }));

jest.mock('firebase-admin', () => ({
  apps: mockApps,
  app: mockAppGetter,
  initializeApp: mockInitializeApp,
  credential: {
    cert: mockCert,
  },
  messaging: mockMessaging,
}));

import { ConfigService } from '@nestjs/config';
import { FcmPushProvider } from './fcm-push.provider';

describe('FcmPushProvider', () => {
  beforeEach(() => {
    mockApps.length = 0;
    mockSendEachForMulticast.mockReset();
    mockMessaging.mockClear();
    mockInitializeApp.mockClear();
    mockAppGetter.mockClear();
    mockCert.mockClear();
  });

  it('returns skipped result when FCM credentials are not configured', async () => {
    const provider = new FcmPushProvider(configWithCredentials(''));
    provider.onModuleInit();

    const result = await provider.sendToTokens(['token-1'], {
      title: 'Title',
      body: 'Body',
    });

    expect(result).toMatchObject({
      successCount: 0,
      failureCount: 0,
      skippedCount: 1,
      retryableFailureCount: 0,
      invalidTokens: [],
    });
    expect(mockInitializeApp).not.toHaveBeenCalled();
    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
  });

  it('throws during send when credentials are present but invalid', async () => {
    const provider = new FcmPushProvider(configWithCredentials('{not-json'));
    provider.onModuleInit();

    await expect(
      provider.sendToTokens(['token-1'], { title: 'Title', body: 'Body' }),
    ).rejects.toThrow('FCM push provider is not initialized');
  });

  it('collects success, invalid tokens, and retryable failures from FCM', async () => {
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 2,
      responses: [
        { success: true },
        {
          success: false,
          error: {
            code: 'messaging/registration-token-not-registered',
            message: 'Token is gone',
          },
        },
        {
          success: false,
          error: {
            code: 'messaging/internal-error',
            message: 'Try again later',
          },
        },
      ],
    });
    const provider = new FcmPushProvider(configWithCredentials(validJson()));
    provider.onModuleInit();

    const result = await provider.sendToTokens(
      ['token-ok', 'token-invalid', 'token-retry'],
      { title: 'Title', body: 'Body', data: { route: 'course' } },
    );

    expect(result).toEqual({
      successCount: 1,
      failureCount: 2,
      skippedCount: 0,
      retryableFailureCount: 1,
      invalidTokens: ['token-invalid'],
    });
  });

  it('sends tokens in FCM multicast batches of 500', async () => {
    mockSendEachForMulticast
      .mockResolvedValueOnce({
        successCount: 500,
        failureCount: 0,
        responses: Array.from({ length: 500 }, () => ({ success: true })),
      })
      .mockResolvedValueOnce({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });
    const provider = new FcmPushProvider(configWithCredentials(validJson()));
    provider.onModuleInit();

    const tokens = Array.from({ length: 501 }, (_, index) => `token-${index}`);
    const result = await provider.sendToTokens(tokens, {
      title: 'Title',
      body: 'Body',
    });

    expect(result.successCount).toBe(501);
    expect(mockSendEachForMulticast).toHaveBeenCalledTimes(2);
    expect(mockSendEachForMulticast.mock.calls[0][0].tokens).toHaveLength(500);
    expect(mockSendEachForMulticast.mock.calls[1][0].tokens).toHaveLength(1);
  });
});

function configWithCredentials(value: string): ConfigService {
  return {
    get: jest.fn(() => value),
  } as unknown as ConfigService;
}

function validJson(): string {
  return JSON.stringify({
    project_id: 'project-id',
    client_email: 'firebase-adminsdk@example.iam.gserviceaccount.com',
    private_key: 'private-key',
  });
}
