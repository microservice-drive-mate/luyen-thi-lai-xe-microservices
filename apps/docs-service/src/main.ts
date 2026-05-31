import { NestFactory, Reflector } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
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
import { AppModule } from './app.module';

const serviceName = 'docs-service';
startOpenTelemetry({ serviceName });
installLocalDevTransientErrorGuard(serviceName);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  setupCors(app);
  app.use(new CorrelationIdMiddleware().use);
  app.use(new TracingMiddleware(serviceName).use);
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

  // Placeholder document — actual service specs are loaded dynamically
  // by Swagger UI via the configUrl below.
  const placeholderDocument = {
    openapi: '3.0.0',
    info: { title: 'Centralized API Documentation', version: '1.0.0' },
    paths: {},
  };

  // configUrl tells Swagger UI to fetch /docs-config on every page load.
  // That endpoint probes which services are alive at that moment, so the
  // service dropdown updates on a simple browser refresh — no server restart.
  SwaggerModule.setup('docs', app, placeholderDocument, {
    explorer: true,
    swaggerOptions: {
      configUrl: '/docs-config',
    },
  });

  await app.listen(port);
  logger.log(`Docs Service running at http://localhost:${port}/docs`);
}
void runBootstrapWithRetries(serviceName, bootstrap);
