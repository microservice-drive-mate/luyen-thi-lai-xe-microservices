import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ApiExceptionFilter, ApiResponseInterceptor } from '@repo/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3000;

  // Log config source for debugging
  console.log('✓ Configuration loaded from Consul (or .env fallback)');

  await app.listen(port);
  console.log(`✓ Course Service listening on port ${port}`);
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
