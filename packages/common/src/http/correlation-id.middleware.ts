import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  createCorrelationId,
  CORRELATION_ID_HEADER,
  resolveHttpCorrelationId,
  runWithCorrelationId,
} from './correlation-context';

declare module 'express-serve-static-core' {
  interface Request {
    correlationId?: string;
  }
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const existing = resolveHttpCorrelationId(request);
    const correlationId =
      existing && existing.length > 0 ? existing : createCorrelationId();

    request.correlationId = correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);
    runWithCorrelationId(correlationId, next);
  }
}
