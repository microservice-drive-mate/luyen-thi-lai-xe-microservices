/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
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
        queue: 'question_service_events',
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
    new AccessLogInterceptor({ serviceName: 'question-service' }),
    new ApiResponseInterceptor(),
  );
  app.useGlobalFilters(new ApiExceptionFilter(), new DomainExceptionFilter());

  setupMicroserviceSwagger(app, {
    title: 'Question Service API',
    description: 'Quan ly ngan hang cau hoi cho dich vu luyen thi lai xe',
  });

  const port = configService.get<number>('port') ?? 3000;

  await app.startAllMicroservices();
  await app.listen(port);
  logger.log(`Question Service listening on port ${port}`);
}
void bootstrap();
