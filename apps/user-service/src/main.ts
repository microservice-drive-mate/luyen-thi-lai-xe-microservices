import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import {
  ApiExceptionFilter,
  ApiResponseInterceptor,
  setupMicroserviceSwagger,
} from '@repo/common';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './infrastructure/filters/domain-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const rabbitmqUrl =
    configService.get<string>('rabbitmq.url') ?? 'amqp://localhost:5672';

  // Connect RabbitMQ microservice for consuming events
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: 'user_service_events',
      queueOptions: { durable: true },
      noAck: false,
    },
  });

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter(), new DomainExceptionFilter());

  // Cấu hình Swagger
  setupMicroserviceSwagger(app, {
    title: 'User Service API',
    description: 'Quản lý thông tin và hồ sơ người dùng luyện thi lái xe',
  });

  const port = configService.get<number>('port') ?? 3000;

  await app.startAllMicroservices();
  await app.listen(port);
  console.log(`✓ User Service listening on port ${port}`);
}
void bootstrap();
