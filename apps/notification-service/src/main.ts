/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import {
  ApiExceptionFilter,
  ApiResponseInterceptor,
  AccessLogInterceptor,
  CorrelationIdMiddleware,
  setupMicroserviceSwagger,
  WINSTON_MODULE_NEST_PROVIDER,
} from '@repo/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  const configService = app.get(ConfigService);
  const rabbitmqUrl =
    configService.get<string>('rabbitmq.url') ?? 'amqp://localhost:5672';
  const port = configService.get<number>('port') ?? 3000;

  app.use(new CorrelationIdMiddleware().use);
  app.useGlobalInterceptors(
    new AccessLogInterceptor({ serviceName: 'notification-service' }),
    new ApiResponseInterceptor(),
  );
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new ApiExceptionFilter());

  // Cấu hình Swagger
  setupMicroserviceSwagger(app, {
    title: 'Notification Service API',
    description: 'Quản lý thông báo và cập nhật trạng thái thi cho người dùng',
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: 'notification_service_events',
      queueOptions: { durable: true },
      noAck: false,
    },
  });

  await app.startAllMicroservices();
  await app.listen(port);
  logger.log(`Notification Service listening on port ${port}`);
}
void bootstrap();
