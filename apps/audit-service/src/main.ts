import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import {
  AccessLogInterceptor,
  ApiExceptionFilter,
  ApiResponseInterceptor,
  assertRabbitMqResilienceTopology,
  createRabbitMqConsumerOptions,
  CorrelationIdInterceptor,
  CorrelationIdMiddleware,
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

const serviceName = 'audit-service';
startOpenTelemetry({ serviceName });
installLocalDevTransientErrorGuard(serviceName);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  const configService = app.get(ConfigService);
  const rabbitmqUrl = getRabbitMqUrl(configService);
  const rabbitmqQueue = 'audit_service_events';
  await assertRabbitMqResilienceTopology(rabbitmqUrl, {
    queue: rabbitmqQueue,
  });
  const port = configService.get<number>('port') ?? 3000;

  app
    .connectMicroservice(
      createRabbitMqConsumerOptions({ url: rabbitmqUrl, queue: rabbitmqQueue }),
    )
    .useGlobalInterceptors(
      new CorrelationIdInterceptor(),
      new TracingInterceptor(serviceName),
      new RabbitMqRetryInterceptor(
        { queue: rabbitmqQueue },
        app.get(MetricsService),
      ),
    );

  app.enableCors();
  const correlationIdMiddleware = new CorrelationIdMiddleware();
  const tracingMiddleware = new TracingMiddleware(serviceName);
  app.use((request: Request, response: Response, next: NextFunction) =>
    correlationIdMiddleware.use(request, response, next),
  );
  app.use((request: Request, response: Response, next: NextFunction) =>
    tracingMiddleware.use(request, response, next),
  );
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(
    new CorrelationIdInterceptor(),
    new TracingInterceptor(serviceName),
    new AccessLogInterceptor({ serviceName }),
    new ApiResponseInterceptor(app.get(Reflector)),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  setupMicroserviceSwagger(app, {
    title: 'Audit Service API',
    description: 'Centralized immutable security audit trail',
  });

  await app.startAllMicroservices();
  await app.listen(port);
}
void runBootstrapWithRetries(serviceName, bootstrap);
