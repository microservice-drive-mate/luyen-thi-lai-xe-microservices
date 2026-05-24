import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import {
  AccessLogInterceptor,
  ApiExceptionFilter,
  ApiResponseInterceptor,
  CorrelationIdMiddleware,
  setupMicroserviceSwagger,
  WINSTON_MODULE_NEST_PROVIDER,
} from '@repo/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  const configService = app.get(ConfigService);
  const rabbitmqUrl =
    configService.get<string>('rabbitmq.url') ?? 'amqp://localhost:5672';
  const port = configService.get<number>('port') ?? 3000;

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: 'audit_service_events',
      queueOptions: { durable: true },
      noAck: false,
    },
  });

  app.enableCors();
  app.use(new CorrelationIdMiddleware().use);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(
    new AccessLogInterceptor({ serviceName: 'audit-service' }),
    new ApiResponseInterceptor(),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  setupMicroserviceSwagger(app, {
    title: 'Audit Service API',
    description: 'Centralized immutable security audit trail',
  });

  await app.startAllMicroservices();
  await app.listen(port);
}
void bootstrap();
