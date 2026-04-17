import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ApiExceptionFilter, ApiResponseInterceptor } from '@repo/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3000;

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://rabbitmq:5672'],
      queue: 'notification_queue',
    },
  });

  // Log config source for debugging
  console.log('✓ Configuration loaded from Consul (or .env fallback)');

  // 3. Khởi động cả hai
  await app.startAllMicroservices(); // Chạy RabbitMQ ngầm
  await app.listen(port); // Mở cổng cho HTTP
  console.log(`✓ Notification Service listening on port ${port}`);
}
void bootstrap();
