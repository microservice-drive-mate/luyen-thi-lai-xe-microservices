import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import {
  PushMessage,
  PushProvider,
  PushSendResult,
} from '../../application/ports/push.provider';

const INVALID_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

const FCM_MULTICAST_BATCH_SIZE = 500;

@Injectable()
export class FcmPushProvider extends PushProvider implements OnModuleInit {
  private readonly logger = new Logger(FcmPushProvider.name);
  private app: admin.app.App | null = null;
  private disabled = false;
  private initError: Error | null = null;

  constructor(private readonly configService: ConfigService) {
    super();
  }

  onModuleInit(): void {
    const credentialsRaw = this.configService.get<string>(
      'push.fcmCredentials',
    );
    if (!credentialsRaw) {
      this.disabled = true;
      this.logger.warn(
        'push.fcmCredentials is empty; push notifications are disabled. ' +
          'Provide an FCM service-account JSON value to enable real push delivery.',
      );
      return;
    }

    try {
      const parsed = JSON.parse(credentialsRaw) as admin.ServiceAccount;
      this.app = admin.apps.length
        ? admin.app()
        : admin.initializeApp({ credential: admin.credential.cert(parsed) });
      this.logger.log('Firebase Admin initialized for FCM push delivery');
    } catch (error) {
      this.initError =
        error instanceof Error ? error : new Error('Unknown FCM init error');
      this.logger.error(
        `Failed to initialize Firebase Admin: ${this.initError.message}`,
      );
      this.app = null;
    }
  }

  async sendToTokens(
    tokens: string[],
    message: PushMessage,
  ): Promise<PushSendResult> {
    if (tokens.length === 0) {
      return this.emptyResult();
    }

    if (this.disabled) {
      this.logger.warn(
        `FCM is not configured; skipping push delivery to ${tokens.length} token(s)`,
      );
      return {
        ...this.emptyResult(),
        skippedCount: tokens.length,
      };
    }

    if (!this.app) {
      throw new Error(
        `FCM push provider is not initialized: ${
          this.initError?.message ?? 'Firebase Admin app is missing'
        }`,
      );
    }

    const result = this.emptyResult();

    for (
      let start = 0;
      start < tokens.length;
      start += FCM_MULTICAST_BATCH_SIZE
    ) {
      const batchTokens = tokens.slice(start, start + FCM_MULTICAST_BATCH_SIZE);
      const response = await admin.messaging(this.app).sendEachForMulticast({
        tokens: batchTokens,
        notification: { title: message.title, body: message.body },
        data: message.data,
      });

      result.successCount += response.successCount;
      result.failureCount += response.failureCount;

      response.responses.forEach((resp, index) => {
        if (resp.success) {
          return;
        }

        const code = resp.error?.code ?? '';
        this.logger.warn(
          `Push failed for token index ${start + index}: ${code} ${
            resp.error?.message ?? ''
          }`,
        );

        if (INVALID_TOKEN_ERRORS.has(code)) {
          result.invalidTokens.push(batchTokens[index]);
          return;
        }

        result.retryableFailureCount += 1;
      });
    }

    return result;
  }

  private emptyResult(): PushSendResult {
    return {
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      retryableFailureCount: 0,
      invalidTokens: [],
    };
  }
}
