import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import {
  AccessLogInterceptor,
  ApiExceptionFilter,
  ApiResponseInterceptor,
  assertRabbitMqResilienceTopology,
  CorrelationIdInterceptor,
  CorrelationIdMiddleware,
  createRabbitMqConsumerOptions,
  DEFAULT_RABBITMQ_RETRY_DELAYS_MS,
  getRabbitMqUrl,
  installLocalDevTransientErrorGuard,
  MetricsService,
  RabbitMqRetryInterceptor,
  runBootstrapWithRetries,
  setupMicroserviceSwagger,
  startOpenTelemetry,
  TracingInterceptor,
  TracingMiddleware,
  WINSTON_MODULE_NEST_PROVIDER,
} from '@repo/common';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './infrastructure/filters/domain-exception.filter';
import { RedisSocketIoAdapter } from './infrastructure/websockets/redis-socket-io.adapter';

const serviceName = 'notification-service';
startOpenTelemetry({ serviceName });
installLocalDevTransientErrorGuard(serviceName);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const configService = app.get(ConfigService);
  const redisSocketIoAdapter = new RedisSocketIoAdapter(app, configService);
  await redisSocketIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisSocketIoAdapter);

  const rabbitmqUrl = getRabbitMqUrl(configService);
  const rabbitmqQueue = 'notification_service_events';
  const retryDelaysMs = createRetryDelays(configService);
  await assertRabbitMqResilienceTopology(rabbitmqUrl, {
    queue: rabbitmqQueue,
    retryDelaysMs,
  });
  const port = configService.get<number>('port') ?? 3000;

  app.enableCors();
  const correlationIdMiddleware = new CorrelationIdMiddleware();
  const tracingMiddleware = new TracingMiddleware(serviceName);
  app.use((request: Request, response: Response, next: NextFunction) =>
    correlationIdMiddleware.use(request, response, next),
  );
  app.use((request: Request, response: Response, next: NextFunction) =>
    tracingMiddleware.use(request, response, next),
  );
  app.useGlobalInterceptors(
    new CorrelationIdInterceptor(),
    new TracingInterceptor(serviceName),
    new AccessLogInterceptor({ serviceName }),
    new ApiResponseInterceptor(app.get(Reflector)),
  );
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new ApiExceptionFilter(), new DomainExceptionFilter());

  setupMicroserviceSwagger(app, {
    title: 'Notification Service API',
    description:
      'Dịch vụ gửi thông báo bất đồng bộ (in-app, email qua SMTP/Mailpit, push qua FCM) và tiêu thụ event RabbitMQ với retry/DLQ.',
  });

  app
    .connectMicroservice(
      createRabbitMqConsumerOptions({
        url: rabbitmqUrl,
        queue: rabbitmqQueue,
      }),
    )
    .useGlobalInterceptors(
      new CorrelationIdInterceptor(),
      new TracingInterceptor(serviceName),
      new RabbitMqRetryInterceptor(
        {
          queue: rabbitmqQueue,
          retryDelaysMs,
        },
        app.get(MetricsService),
      ),
    );

  await app.startAllMicroservices();
  await app.listen(port);
  logger.log(`Notification Service listening on port ${port}`);
}
void runBootstrapWithRetries(serviceName, bootstrap);

function createRetryDelays(configService: ConfigService): number[] {
  const configuredMaxAttempts = configService.get<number>('retry.maxAttempts');
  const configuredIntervalMs = configService.get<number>('retry.intervalMs');

  if (
    configuredMaxAttempts === undefined &&
    configuredIntervalMs === undefined
  ) {
    return DEFAULT_RABBITMQ_RETRY_DELAYS_MS;
  }

  const maxAttempts = Math.max(
    1,
    configuredMaxAttempts ?? DEFAULT_RABBITMQ_RETRY_DELAYS_MS.length,
  );

  if (configuredIntervalMs === undefined) {
    return Array.from(
      { length: maxAttempts },
      (_, index) =>
        DEFAULT_RABBITMQ_RETRY_DELAYS_MS[
          Math.min(index, DEFAULT_RABBITMQ_RETRY_DELAYS_MS.length - 1)
        ],
    );
  }

  const intervalMs = Math.max(1000, configuredIntervalMs);

  return Array.from({ length: maxAttempts }, () => intervalMs);
}
