/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { NestFactory, Reflector } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiExceptionFilter,
  ApiResponseInterceptor,
  AccessLogInterceptor,
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

const serviceName = 'analytics-service';
startOpenTelemetry({ serviceName });
installLocalDevTransientErrorGuard(serviceName);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  const configService = app.get(ConfigService);
  const rabbitmqUrl = getRabbitMqUrl(configService);
  const rabbitmqQueue = 'analytics_service_events';
  await assertRabbitMqResilienceTopology(rabbitmqUrl, {
    queue: rabbitmqQueue,
  });

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

  // Cấu hình Swagger
  setupMicroserviceSwagger(app, {
    title: 'Analytics Service API',
    description:
      'Quản lý thông tin và phân tích dữ liệu cho dịch vụ  luyện thi lái xe',
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

  await app.startAllMicroservices();
  await app.listen(port);
  logger.log(`Analytics Service listening on port ${port}`);
}
void runBootstrapWithRetries(serviceName, bootstrap);
