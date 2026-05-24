import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import {
  CORRELATION_ID_HEADER,
  getCurrentCorrelationId,
} from './correlation-context';

interface AccessLogOptions {
  serviceName: string;
}

interface RequestWithUser extends Request {
  user?: {
    sub?: string;
    realm_access?: { roles?: string[] };
  };
  correlationId?: string;
}

@Injectable()
export class AccessLogInterceptor implements NestInterceptor {
  private readonly logger: Logger;

  constructor(private readonly options: AccessLogOptions) {
    this.logger = new Logger(`${options.serviceName}:AccessLog`);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const startedAt = Date.now();
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithUser>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      tap({
        next: () => this.logAccess(request, response, startedAt),
        error: () => this.logAccess(request, response, startedAt),
      }),
    );
  }

  private logAccess(
    request: RequestWithUser,
    response: Response,
    startedAt: number,
  ): void {
    const metadata = {
      logType: 'access',
      serviceName: this.options.serviceName,
      correlationId:
        request.correlationId ??
        getHeader(request, CORRELATION_ID_HEADER) ??
        getCurrentCorrelationId(),
      method: request.method,
      path: request.originalUrl ?? request.url,
      statusCode: response.statusCode,
      latencyMs: Date.now() - startedAt,
      actorId: request.user?.sub ?? getHeader(request, 'x-user-id') ?? null,
      actorRole: request.user?.realm_access?.roles?.[0] ?? null,
      ipAddress:
        getHeader(request, 'x-forwarded-for')?.split(',')[0]?.trim() ??
        request.ip,
      userAgent: getHeader(request, 'user-agent') ?? null,
      isHealthCheck: (request.originalUrl ?? request.url).startsWith('/health'),
    };

    this.logger.log(JSON.stringify(metadata));
  }
}

function getHeader(request: Request, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }

  return typeof value === 'string' ? value : undefined;
}
