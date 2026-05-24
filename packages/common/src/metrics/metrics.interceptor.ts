import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { finalize, Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const route = request.originalUrl ?? request.url;

    if (route.startsWith('/metrics')) {
      return next.handle();
    }

    const startedAt = process.hrtime.bigint();
    let errorStatusCode: number | undefined;

    return next.handle().pipe(
      tap({
        error: (error: unknown) => {
          errorStatusCode =
            error instanceof HttpException ? error.getStatus() : 500;
        },
      }),
      finalize(() => {
        const durationSeconds =
          Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;

        this.metricsService.recordHttpRequest({
          method: request.method,
          route,
          statusCode: errorStatusCode ?? response.statusCode,
          durationSeconds,
        });
      }),
    );
  }
}
