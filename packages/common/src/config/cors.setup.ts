import { INestApplication } from '@nestjs/common';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3009',
  'http://localhost:4173',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4200',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3009',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:4200',
];

function getAllowedOrigins(): string[] {
  const configured =
    process.env.CORS_ALLOWED_ORIGINS ?? process.env.KONG_CORS_ORIGINS;
  if (!configured) return DEFAULT_ALLOWED_ORIGINS;

  const configuredOrigins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(
    new Set([...configuredOrigins, ...DEFAULT_ALLOWED_ORIGINS]),
  );
}

export function setupCors(app: INestApplication): void {
  const allowedOrigins = getAllowedOrigins();
  const allowAll = allowedOrigins.includes('*');

  app.enableCors({
    origin(origin, callback) {
      if (!origin || allowAll || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Accept',
      'Authorization',
      'Content-Type',
      'Origin',
      'X-Requested-With',
      'x-correlation-id',
      'x-user-id',
      'x-user-role',
    ],
    exposedHeaders: ['Authorization', 'x-correlation-id'],
    maxAge: 3600,
  });
}
