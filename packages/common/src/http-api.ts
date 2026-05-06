import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type {
  ArgumentsHost,
  CallHandler,
  ExecutionContext,
  ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { map, Observable } from 'rxjs';

export type ApiErrorCode =
  | 'SUCCESS'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_ERROR';

export function mapStatusToErrorCode(status: number): ApiErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'VALIDATION_ERROR';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'TOO_MANY_REQUESTS';
    default:
      return 'INTERNAL_ERROR';
  }
}

@Injectable()
export class ApiResponseInterceptor<T>
  implements
    NestInterceptor<
      T,
      {
        success: boolean;
        code: string;
        message: string;
        timestamp: string;
        path: string;
        data: T;
      }
    >
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<{
    success: boolean;
    code: string;
    message: string;
    timestamp: string;
    path: string;
    data: T;
  }> {
    if (context.getType() !== 'http') {
      return next.handle() as Observable<{
        success: boolean;
        code: string;
        message: string;
        timestamp: string;
        path: string;
        data: T;
      }>;
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        if (
          data &&
          typeof data === 'object' &&
          'success' in (data as Record<string, unknown>) &&
          'code' in (data as Record<string, unknown>)
        ) {
          return data as unknown as {
            success: boolean;
            code: string;
            message: string;
            timestamp: string;
            path: string;
            data: T;
          };
        }

        return {
          success: true,
          code: 'SUCCESS',
          message:
            response.statusCode === HttpStatus.CREATED ? 'Created' : 'OK',
          timestamp: new Date().toISOString(),
          path: request.originalUrl ?? request.url,
          data,
        };
      }),
    );
  }
}

export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let code: ApiErrorCode = mapStatusToErrorCode(status);
    let message = 'Internal server error';
    let errors: unknown;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const responseObject = exceptionResponse as Record<string, unknown>;

      if (typeof responseObject.code === 'string') {
        code = responseObject.code as ApiErrorCode;
      }

      if (typeof responseObject.message === 'string') {
        message = responseObject.message;
      }

      if (Array.isArray(responseObject.message)) {
        message = 'Validation failed';
        errors = responseObject.message;
      }

      if ('errors' in responseObject) {
        errors = responseObject.errors;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (exception instanceof BadRequestException && !errors) {
      const badRequestResponse = exception.getResponse();
      if (
        typeof badRequestResponse === 'object' &&
        badRequestResponse !== null &&
        Array.isArray((badRequestResponse as Record<string, unknown>).message)
      ) {
        message = 'Validation failed';
        errors = (badRequestResponse as Record<string, unknown>).message;
        code = 'VALIDATION_ERROR';
      }
    }

    response.status(status).json({
      success: false,
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
      errors,
    });
  }
}
