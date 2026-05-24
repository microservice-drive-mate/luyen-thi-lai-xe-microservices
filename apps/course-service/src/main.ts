/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger, ValidationPipe } from '@nestjs/common';
import {
  ApiExceptionFilter,
  ApiResponseInterceptor,
  AccessLogInterceptor,
  CorrelationIdInterceptor,
  CorrelationIdMiddleware,
  setupMicroserviceSwagger,
  WINSTON_MODULE_NEST_PROVIDER,
} from '@repo/common';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './infrastructure/filters/domain-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const configService = app.get(ConfigService);
  const rabbitmqUrl =
    configService.get<string>('rabbitmq.url') ?? 'amqp://localhost:5672';

  app
    .connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [rabbitmqUrl],
        queue: 'course_service_events',
        queueOptions: { durable: true },
        noAck: false,
      },
    })
    .useGlobalInterceptors(new CorrelationIdInterceptor());

  app.enableCors();
  app.use(new CorrelationIdMiddleware().use);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(
    new CorrelationIdInterceptor(),
    new AccessLogInterceptor({ serviceName: 'course-service' }),
    new ApiResponseInterceptor(),
  );
  app.useGlobalFilters(new ApiExceptionFilter(), new DomainExceptionFilter());

  setupMicroserviceSwagger(app, {
    title: 'Course Service API',
    description:
      'Quản lý khóa học và tiến trình học cho dịch vụ luyện thi lái xe',
  });

  const port = configService.get<number>('port') ?? 3000;

  await app.startAllMicroservices();
  await app.listen(port);
  logger.log(`Course Service listening on port ${port}`);
}
void bootstrap();
