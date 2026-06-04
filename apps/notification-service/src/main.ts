/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
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

const serviceName = 'notification-service';
startOpenTelemetry({ serviceName });
installLocalDevTransientErrorGuard(serviceName);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const configService = app.get(ConfigService);
  const rabbitmqUrl = getRabbitMqUrl(configService);
  const rabbitmqQueue = 'notification_service_events';
  const retryDelaysMs = createRetryDelays(configService);
  await assertRabbitMqResilienceTopology(rabbitmqUrl, {
    queue: rabbitmqQueue,
    retryDelaysMs,
  });
  const port = configService.get<number>('port') ?? 3000;

  app.enableCors();
  app.use(new CorrelationIdMiddleware().use);
  app.use(new TracingMiddleware(serviceName).use);
  app.useGlobalInterceptors(
    new CorrelationIdInterceptor(),
    new TracingInterceptor(serviceName),
    new AccessLogInterceptor({ serviceName }),
    new ApiResponseInterceptor(app.get(Reflector)),
  );
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new ApiExceptionFilter());

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
