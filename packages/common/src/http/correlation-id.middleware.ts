import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  createCorrelationId,
  CORRELATION_ID_HEADER,
  resolveHttpCorrelationId,
  resolveK6Context,
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

    const k6Context = resolveK6Context(request);

    request.correlationId = correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    if (k6Context.k6TraceId) {
      response.setHeader('x-k6-trace-id', k6Context.k6TraceId);
    }

    runWithCorrelationId(correlationId, next, k6Context);
  }
}
