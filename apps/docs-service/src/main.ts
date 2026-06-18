import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import {
  AccessLogInterceptor,
  ApiExceptionFilter,
  ApiResponseInterceptor,
  CorrelationIdInterceptor,
  CorrelationIdMiddleware,
  installLocalDevTransientErrorGuard,
  runBootstrapWithRetries,
  setupCors,
  startOpenTelemetry,
  TracingInterceptor,
  TracingMiddleware,
  WINSTON_MODULE_NEST_PROVIDER,
} from '@repo/common';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

const serviceName = 'docs-service';
startOpenTelemetry({ serviceName });
installLocalDevTransientErrorGuard(serviceName);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  setupCors(app);

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

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3009;

  await app.listen(port);
  logger.log(`Docs Service running at http://localhost:${port}/docs`);
}
void runBootstrapWithRetries(serviceName, bootstrap);
