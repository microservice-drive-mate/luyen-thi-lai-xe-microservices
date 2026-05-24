import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { DomainException } from '@repo/common';
import { Request, Response } from 'express';

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusMap: Record<string, number> = {
      IDENTITY_USER_NOT_FOUND: HttpStatus.NOT_FOUND,
      IDENTITY_USER_ALREADY_EXISTS: HttpStatus.CONFLICT,
      IDENTITY_USER_ALREADY_DELETED: HttpStatus.CONFLICT,
      INVALID_EMAIL: HttpStatus.BAD_REQUEST,
    };

    const status = statusMap[exception.code] ?? HttpStatus.BAD_REQUEST;

    response.status(status).json({
      success: false,
      code: exception.code,
      message: exception.message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
