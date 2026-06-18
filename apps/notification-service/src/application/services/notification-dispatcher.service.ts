import crypto from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { DeviceTokenRepository } from '../../domain/repositories/device-token.repository';
import {
  Notification,
  NotificationRecord,
  NotificationRepository,
  NotificationType,
} from '../../domain/repositories/notification.repository';
import { NotificationMetrics } from '../../infrastructure/metrics/notification.metrics';
import { MailProvider } from '../ports/mail.provider';
import {
  PushMessage,
  PushProvider,
  PushSendResult,
} from '../ports/push.provider';
import {
  NOTIFICATION_WS_EVENTS,
  NotificationCreatedPayload,
  NotificationUnreadCountPayload,
  WsEmitterPort,
} from '../ports/ws-emitter.port';

export interface DispatchInput {
  eventType: string;
  userId: string;
  recipientEmail?: string;
  title: string;
  body: string;
  html?: string;
  data?: Record<string, unknown>;
  channels: NotificationType[];
  retryCount?: number;
}

interface DeliveryOutcome {
  skipped: boolean;
}

@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    private readonly repository: NotificationRepository,
    private readonly deviceTokenRepository: DeviceTokenRepository,
    private readonly mailProvider: MailProvider,
    private readonly pushProvider: PushProvider,
    private readonly metrics: NotificationMetrics,
    private readonly wsEmitter: WsEmitterPort,
  ) {}

  async dispatch(input: DispatchInput): Promise<NotificationRecord[]> {
    const created: NotificationRecord[] = [];
    for (const channel of input.channels) {
      const notification = Notification.createQueued({
        id: crypto.randomUUID(),
        userId: input.userId,
        title: input.title,
        body: input.body,
        type: channel,
        eventType: input.eventType,
        data: input.data ?? {},
        retryCount: input.retryCount ?? 0,
      });
      const record = await this.repository.createNotification(notification);

      try {
        const outcome = await this.deliverOne(channel, record, input);
        const deliveredNotification = Notification.reconstitute(record);
        deliveredNotification.markDelivered();
        const delivered = await this.repository.saveNotificationDelivery(
          deliveredNotification,
        );
        if (outcome.skipped) {
          this.metrics.recordSkipped(channel, input.eventType);
        } else {
          this.metrics.recordSuccess(channel, input.eventType);
        }
        created.push(delivered);
        if (channel === NotificationType.IN_APP) {
          await this.emitInAppDelivered(delivered);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown delivery error';
        const failedNotification = Notification.reconstitute(record);
        failedNotification.markFailed(message);
        const failed =
          await this.repository.saveNotificationDelivery(failedNotification);
        this.metrics.recordFailure(channel, input.eventType);
        created.push(failed);
        // Bubble up so the messaging layer can decide retry semantics.
        throw error;
      }
    }
    return created;
  }

  private async emitInAppDelivered(record: NotificationRecord): Promise<void> {
    try {
      const unreadCount = await this.repository.countUnreadByUser(
        record.userId,
      );
      const createdPayload: NotificationCreatedPayload = {
        notification: record,
        unreadCount,
      };
      const unreadCountPayload: NotificationUnreadCountPayload = {
        unreadCount,
      };
      this.wsEmitter.emitToUser(
        record.userId,
        NOTIFICATION_WS_EVENTS.CREATED,
        createdPayload,
      );
      this.wsEmitter.emitToUser(
        record.userId,
        NOTIFICATION_WS_EVENTS.UNREAD_COUNT_UPDATED,
        unreadCountPayload,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown websocket error';
      this.logger.warn(
        `Unable to emit realtime notification ${record.id}: ${message}`,
      );
    }
  }

  private async deliverOne(
    channel: NotificationType,
    record: NotificationRecord,
    input: DispatchInput,
  ): Promise<DeliveryOutcome> {
    if (channel === NotificationType.IN_APP) {
      return { skipped: false };
    }

    if (channel === NotificationType.EMAIL) {
      if (!input.recipientEmail) {
        throw new Error(
          `Cannot send EMAIL notification ${record.id}: recipient email is missing`,
        );
      }
      await this.mailProvider.send({
        to: input.recipientEmail,
        subject: input.title,
        text: input.body,
        html: input.html,
      });
      return { skipped: false };
    }

    if (channel === NotificationType.PUSH) {
      return this.deliverPush(record, input);
    }

    return { skipped: true };
  }

  private async deliverPush(
    record: NotificationRecord,
    input: DispatchInput,
  ): Promise<DeliveryOutcome> {
    const tokens = await this.deviceTokenRepository.findByUser(input.userId);
    if (tokens.length === 0) {
      this.logger.warn(
        `User ${input.userId} has no registered device tokens; skipping push for ${record.id}`,
      );
      return { skipped: true };
    }

    const message: PushMessage = {
      title: input.title,
      body: input.body,
      data: this.flattenData(input.data),
    };
    const result: PushSendResult = await this.pushProvider.sendToTokens(
      tokens.map((token) => token.token),
      message,
    );

    if (result.invalidTokens.length > 0) {
      await this.deviceTokenRepository.deleteManyTokens(result.invalidTokens);
      this.logger.log(
        `Deleted ${result.invalidTokens.length} invalid device token(s)`,
      );
    }

    if (result.successCount > 0) {
      return { skipped: false };
    }

    if (result.retryableFailureCount > 0) {
      throw new Error(
        'All push delivery attempts failed with retryable errors',
      );
    }

    const skippedCount = result.skippedCount + result.invalidTokens.length;
    if (skippedCount > 0 || result.failureCount > 0) {
      this.logger.warn(
        `Push delivery for ${record.id} was skipped or had only non-retryable failures`,
      );
      return { skipped: true };
    }

    return { skipped: true };
  }

  private flattenData(
    data?: Record<string, unknown>,
  ): Record<string, string> | undefined {
    if (!data) return undefined;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      out[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return out;
  }
}
