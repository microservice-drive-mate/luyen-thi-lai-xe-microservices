import { NestFactory } from '@nestjs/core';
import { ApiExceptionFilter, ApiResponseInterceptor } from '@repo/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3000;

  // Log config source for debugging
  console.log('✓ Configuration loaded from Consul (or .env fallback)');

  await app.listen(port);
  console.log(`✓ User Service listening on port ${port}`);
}
void bootstrap();
