import { Injectable, NestMiddleware } from '@nestjs/common';
import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  type TextMapGetter,
} from '@opentelemetry/api';
import type { NextFunction, Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from '../http/correlation-context';
import { isOpenTelemetryEnabled } from './opentelemetry';

const httpHeaderGetter: TextMapGetter<Request['headers']> = {
  keys(carrier) {
    return Object.keys(carrier);
  },
  get(carrier, key) {
    const value = carrier[key.toLowerCase()];

    if (Array.isArray(value)) {
      return value;
    }

    return typeof value === 'string' ? value : undefined;
  },
};

@Injectable()
export class TracingMiddleware implements NestMiddleware {
  constructor(private readonly serviceName: string) {}

  use = (request: Request, response: Response, next: NextFunction): void => {
    if (!isOpenTelemetryEnabled()) {
      next();
      return;
    }

    const parentContext = propagation.extract(
      context.active(),
      request.headers,
      httpHeaderGetter,
    );
    const tracer = trace.getTracer(this.serviceName);
    const method = request.method;
    const path = request.originalUrl ?? request.url;

    tracer.startActiveSpan(
      `${method} ${path}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          'service.name': this.serviceName,
          'http.request.method': method,
          'url.path': path,
          'http.route': request.route?.path ?? path,
          [CORRELATION_ID_HEADER]: getHeader(request, CORRELATION_ID_HEADER),
          'user.id': getHeader(request, 'x-user-id'),
          'user.role': getHeader(request, 'x-user-role'),
        },
      },
      parentContext,
      (span) => {
        response.on('finish', () => {
          span.setAttributes({
            'http.response.status_code': response.statusCode,
          });

          if (response.statusCode >= 500) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: `HTTP ${response.statusCode}`,
            });
          }

          span.end();
        });

        response.on('close', () => {
          if (!response.writableEnded) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: 'HTTP connection closed before response finished',
            });
            span.end();
          }
        });

        next();
      },
    );
  };
}

function getHeader(request: Request, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0];
  }

  return typeof value === 'string' ? value : undefined;
}
