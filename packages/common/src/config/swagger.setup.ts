import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export interface SwaggerSetupOptions {
  title: string;
  description?: string;
  version?: string;
}

export function setupMicroserviceSwagger(
  app: INestApplication,
  options: SwaggerSetupOptions,
) {
  // Allow cross-origin requests so Swagger UI on docs-service can fetch /docs-json
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle(options.title)
    .setDescription(options.description || `API Documentation for ${options.title}`)
    .setVersion(options.version || '1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Chỉ bật Swagger UI ở môi trường phát triển
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('docs', app, document);
  }

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/docs-json', (req, res) => {
    res.json(document);
  });
}