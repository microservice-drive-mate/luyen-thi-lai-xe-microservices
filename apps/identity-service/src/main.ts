/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  ApiExceptionFilter,
  ApiResponseInterceptor,
  setupMicroserviceSwagger,
} from '@repo/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());

  // Cấu hình Swagger
  setupMicroserviceSwagger(app, {
    title: 'Identity Service API',
    description:
      'Quản lý xác thực và phân quyền người dùng trong hệ thống luyện thi lái xe',
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3000;

  await app.listen(port);
  console.log(`✓ Identity Service listening on port ${port}`);
}
void bootstrap();
