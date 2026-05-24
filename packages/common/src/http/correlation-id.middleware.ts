import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    correlationId?: string;
  }
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const existing = getHeader(request, 'x-correlation-id');
    const correlationId =
      existing && existing.length > 0 ? existing : randomUUID();

    request.correlationId = correlationId;
    response.setHeader('x-correlation-id', correlationId);
    next();
  }
}

function getHeader(request: Request, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }

  return typeof value === 'string' ? value : undefined;
}
