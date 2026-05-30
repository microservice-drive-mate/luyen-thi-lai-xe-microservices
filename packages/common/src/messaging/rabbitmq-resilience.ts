import { createRequire } from 'node:module';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MicroserviceOptions,
  RmqContext,
  RmqOptions,
  Transport,
} from '@nestjs/microservices';
import { EMPTY, Observable, from } from 'rxjs';
import { catchError, mergeMap, tap } from 'rxjs/operators';
import {
  CORRELATION_ID_FIELD,
  CORRELATION_ID_HEADER,
} from '../http/correlation-context';
import { MetricsService } from '../metrics/metrics.service';

export const DEFAULT_RABBITMQ_URL = 'amqp://127.0.0.1:5672';
export const DEFAULT_RABBITMQ_RETRY_DELAYS_MS = [5_000, 30_000, 120_000];
export const DEFAULT_RABBITMQ_PREFETCH_COUNT = 10;

export interface RabbitMqResilienceOptions {
  queue: string;
  retryDelaysMs?: number[];
  prefetchCount?: number;
}

interface RabbitMqMessageProperties {
  headers?: Record<string, unknown>;
  contentType?: string;
  contentEncoding?: string;
  deliveryMode?: number;
  priority?: number;
  correlationId?: string;
  replyTo?: string;
  expiration?: string;
  messageId?: string;
  timestamp?: number;
  type?: string;
  userId?: string;
  appId?: string;
  clusterId?: string;
}

interface RabbitMqMessage {
  content: Buffer;
  properties: RabbitMqMessageProperties;
}

interface RabbitMqChannel {
  ack(message: RabbitMqMessage): void;
  sendToQueue(
    queue: string,
    content: Buffer,
    options?: RabbitMqMessageProperties & { persistent?: boolean },
  ): boolean;
}

interface AmqpChannel extends RabbitMqChannel {
  assertQueue(
    queue: string,
    options: {
      durable: boolean;
      arguments?: Record<string, unknown>;
      messageTtl?: number;
      deadLetterExchange?: string;
      deadLetterRoutingKey?: string;
    },
  ): Promise<unknown>;
  close(): Promise<void>;
}

interface AmqpConnection {
  createChannel(): Promise<AmqpChannel>;
  close(): Promise<void>;
}

interface AmqpModule {
  connect(url: string): Promise<AmqpConnection>;
}

const nodeRequire = createRequire(__filename);
const processedMessageKeys = new Map<string, number>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export function getRabbitMqUrl(config: ConfigService): string {
  const configuredUrl =
    config.get<string>('rabbitmq.url') ??
    config.get<string>('RABBITMQ_URL') ??
    DEFAULT_RABBITMQ_URL;
  const username =
    config.get<string>('rabbitmq.username') ??
    config.get<string>('RABBITMQ_USERNAME') ??
    process.env.RABBITMQ_USERNAME ??
    process.env.RABBITMQ_DEFAULT_USER;
  const password =
    config.get<string>('rabbitmq.password') ??
    config.get<string>('RABBITMQ_PASSWORD') ??
    process.env.RABBITMQ_PASSWORD ??
    process.env.RABBITMQ_DEFAULT_PASS;

  if (!username || !password || hasCredentials(configuredUrl)) {
    return configuredUrl;
  }

  return withCredentials(configuredUrl, username, password);
}

function hasCredentials(url: string): boolean {
  try {
    return new URL(url).username.length > 0;
  } catch {
    return false;
  }
}

function withCredentials(
  url: string,
  username: string,
  password: string,
): string {
  try {
    const parsedUrl = new URL(url);
    parsedUrl.username = username;
    parsedUrl.password = password;
    return parsedUrl.toString();
  } catch {
    const separator = '://';
    const separatorIndex = url.indexOf(separator);
    if (separatorIndex === -1) {
      return url;
    }

    const scheme = url.slice(0, separatorIndex);
    const rest = url.slice(separatorIndex + separator.length);
    return `${scheme}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${rest}`;
  }
}

export function createRabbitMqQueueOptions(_queue: string): {
  durable: boolean;
  arguments: Record<string, string>;
} {
  return {
    durable: true,
    arguments: {},
  };
}

export function createRabbitMqConsumerOptions(
  options: RabbitMqResilienceOptions & { url: string },
): MicroserviceOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [options.url],
      queue: options.queue,
      queueOptions: createRabbitMqQueueOptions(options.queue),
      noAck: false,
      prefetchCount: options.prefetchCount ?? DEFAULT_RABBITMQ_PREFETCH_COUNT,
      persistent: true,
    },
  };
}

export function createRabbitMqClientOptions(
  config: ConfigService,
  queue: string,
): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [getRabbitMqUrl(config)],
      queue,
      queueOptions: createRabbitMqQueueOptions(queue),
      persistent: true,
    },
  };
}

export function getRabbitMqDlqName(queue: string): string {
  return `${queue}.dlq`;
}

export function getRabbitMqRetryQueueName(
  queue: string,
  attempt: number,
): string {
  return `${queue}.retry.${attempt}`;
}

export async function assertRabbitMqResilienceTopology(
  url: string,
  options: RabbitMqResilienceOptions,
): Promise<void> {
  const amqp = nodeRequire('amqplib') as AmqpModule;
  const retryDelaysMs =
    options.retryDelaysMs ?? DEFAULT_RABBITMQ_RETRY_DELAYS_MS;
  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();

  try {
    await channel.assertQueue(
      options.queue,
      createRabbitMqQueueOptions(options.queue),
    );
    await channel.assertQueue(getRabbitMqDlqName(options.queue), {
      durable: true,
    });

    for (const [index, delayMs] of retryDelaysMs.entries()) {
      await channel.assertQueue(
        getRabbitMqRetryQueueName(options.queue, index + 1),
        {
          durable: true,
          messageTtl: delayMs,
          deadLetterExchange: '',
          deadLetterRoutingKey: options.queue,
        },
      );
    }
  } finally {
    await channel.close();
    await connection.close();
  }
}

@Injectable()
export class RabbitMqRetryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RabbitMqRetryInterceptor.name);
  private readonly retryDelaysMs: number[];

  constructor(
    private readonly options: RabbitMqResilienceOptions,
    private readonly metricsService?: MetricsService,
  ) {
    this.retryDelaysMs =
      options.retryDelaysMs ?? DEFAULT_RABBITMQ_RETRY_DELAYS_MS;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'rpc') {
      return next.handle();
    }

    const messageKey = resolveMessageKey(context, this.options.queue);
    if (messageKey && isProcessedMessage(messageKey)) {
      this.logger.warn(`RabbitMQ duplicate message skipped: ${messageKey}`);
      this.metricsService?.recordRabbitMqMessage(this.options.queue, 'success');
      this.ack(context);
      return EMPTY;
    }

    return next.handle().pipe(
      tap(() => {
        if (messageKey) {
          markProcessedMessage(messageKey);
        }
        this.metricsService?.recordRabbitMqMessage(
          this.options.queue,
          'success',
        );
        this.ack(context);
      }),
      catchError((error: unknown) =>
        from(this.retryOrDeadLetter(context, error)).pipe(
          mergeMap(() => EMPTY),
        ),
      ),
    );
  }

  private async retryOrDeadLetter(
    context: ExecutionContext,
    error: unknown,
  ): Promise<void> {
    const rmq = context.switchToRpc().getContext<RmqContext>();
    const channel = rmq.getChannelRef() as RabbitMqChannel;
    const message = rmq.getMessage() as RabbitMqMessage;
    const headers = message.properties.headers ?? {};
    const currentRetryCount = readRetryCount(headers);
    const nextRetryCount = currentRetryCount + 1;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const targetQueue =
      nextRetryCount <= this.retryDelaysMs.length
        ? getRabbitMqRetryQueueName(this.options.queue, nextRetryCount)
        : getRabbitMqDlqName(this.options.queue);

    channel.sendToQueue(targetQueue, message.content, {
      ...message.properties,
      headers: {
        ...headers,
        'x-original-queue': this.options.queue,
        'x-retry-count': nextRetryCount,
        'x-last-error': errorMessage,
        'x-failed-at': new Date().toISOString(),
        [CORRELATION_ID_HEADER]:
          headers[CORRELATION_ID_HEADER] ?? headers[CORRELATION_ID_FIELD],
      },
      persistent: true,
    });
    channel.ack(message);

    const action =
      nextRetryCount <= this.retryDelaysMs.length ? 'retry' : 'dead-letter';
    if (action === 'retry') {
      this.metricsService?.recordRabbitMqMessage(this.options.queue, 'retry');
      this.metricsService?.recordRabbitMqRetry({
        queue: this.options.queue,
        targetQueue,
        retryCount: nextRetryCount,
      });
    } else {
      this.metricsService?.recordRabbitMqMessage(this.options.queue, 'dlq');
      this.metricsService?.recordRabbitMqDeadLetter({
        queue: this.options.queue,
        targetQueue,
        retryCount: nextRetryCount,
      });
    }

    this.logger.error(
      `RabbitMQ ${action}: queue=${this.options.queue}, target=${targetQueue}, retry=${nextRetryCount}, error=${errorMessage}`,
    );
  }

  private ack(context: ExecutionContext): void {
    const rmq = context.switchToRpc().getContext<RmqContext>();
    const channel = rmq.getChannelRef() as RabbitMqChannel;
    const message = rmq.getMessage() as RabbitMqMessage;
    channel.ack(message);
  }
}

function readRetryCount(headers: Record<string, unknown>): number {
  const raw = headers['x-retry-count'];
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }

  if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function resolveMessageKey(
  context: ExecutionContext,
  queue: string,
): string | undefined {
  const rmq = context.switchToRpc().getContext<RmqContext>();
  const message = rmq.getMessage() as RabbitMqMessage;
  const payload = context.switchToRpc().getData<unknown>();
  const messageId =
    readString(message.properties.messageId) ??
    readStringFromRecord(payload, 'eventId') ??
    readStringFromRecord(payload, 'id') ??
    readNestedStringFromRecord(payload, 'metadata', 'eventId');

  return messageId ? `${queue}:${messageId}` : undefined;
}

function isProcessedMessage(messageKey: string): boolean {
  pruneProcessedMessages();
  const expiresAt = processedMessageKeys.get(messageKey);
  return typeof expiresAt === 'number' && expiresAt > Date.now();
}

function markProcessedMessage(messageKey: string): void {
  processedMessageKeys.set(messageKey, Date.now() + IDEMPOTENCY_TTL_MS);
  pruneProcessedMessages();
}

function pruneProcessedMessages(): void {
  const now = Date.now();
  for (const [messageKey, expiresAt] of processedMessageKeys) {
    if (expiresAt <= now) {
      processedMessageKeys.delete(messageKey);
    }
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readStringFromRecord(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return readString((value as Record<string, unknown>)[key]);
}

function readNestedStringFromRecord(
  value: unknown,
  parentKey: string,
  childKey: string,
): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return readStringFromRecord(
    (value as Record<string, unknown>)[parentKey],
    childKey,
  );
}
