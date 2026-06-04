import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { setupCors } from './cors.setup';

export interface SwaggerSetupOptions {
  title: string;
  description?: string;
  serverUrl?: string;
  version?: string;
}

const COMMON_ERROR_RESPONSES = {
  '400': { $ref: '#/components/responses/BadRequest' },
  '401': { $ref: '#/components/responses/Unauthorized' },
  '403': { $ref: '#/components/responses/Forbidden' },
  '404': { $ref: '#/components/responses/NotFound' },
  '500': { $ref: '#/components/responses/InternalServerError' },
};

export function setupMicroserviceSwagger(
  app: INestApplication,
  options: SwaggerSetupOptions,
) {
  setupCors(app);

  const config = new DocumentBuilder()
    .setTitle(options.title)
    .setDescription(
      options.description || `API Documentation for ${options.title}`,
    )
    .setVersion(options.version || '1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  enrichOpenApiDocument(app, document, options);

  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('docs', app, document);
  }

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/docs-json', (_req, res) => {
    res.json(document);
  });
}

function enrichOpenApiDocument(
  app: INestApplication,
  document: OpenAPIObject,
  options: SwaggerSetupOptions,
): void {
  document.components = {
    ...document.components,
    responses: {
      ...document.components?.responses,
      BadRequest: { description: 'Bad request or validation error' },
      Unauthorized: { description: 'Authentication is required or invalid' },
      Forbidden: { description: 'Authenticated user is not allowed' },
      NotFound: { description: 'Requested resource was not found' },
      InternalServerError: { description: 'Unexpected server error' },
    },
  };

  const serverUrl = resolveServerUrl(app, options);
  if (serverUrl) {
    document.servers = [{ url: serverUrl }];
  }
  document.security =
    document.security && document.security.length > 0
      ? document.security
      : [{ bearer: [] }];

  for (const pathItem of Object.values(document.paths)) {
    for (const operation of Object.values(pathItem ?? {})) {
      if (!operation || typeof operation !== 'object') {
        continue;
      }
      const operationRecord = operation as {
        responses?: Record<string, unknown>;
        security?: Array<Record<string, string[]>>;
      };
      operationRecord.responses = {
        ...COMMON_ERROR_RESPONSES,
        ...operationRecord.responses,
      };
    }
  }
}

function resolveServerUrl(
  app: INestApplication,
  options: SwaggerSetupOptions,
): string | undefined {
  if (options.serverUrl) {
    return options.serverUrl;
  }

  const configService = app.get(ConfigService, { strict: false });
  const configuredUrl =
    configService?.get<string>('swagger.serverUrl') ??
    process.env.SWAGGER_SERVER_URL;
  if (configuredUrl) {
    return configuredUrl;
  }

  const port = configService?.get<number>('port') ?? process.env.PORT;
  return port ? `http://localhost:${port}` : undefined;
}
