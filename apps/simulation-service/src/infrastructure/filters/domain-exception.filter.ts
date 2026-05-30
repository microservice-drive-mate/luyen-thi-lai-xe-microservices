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
      PRACTICE2D_INVALID_REQUEST: HttpStatus.BAD_REQUEST,
      PRACTICE2D_UNSUPPORTED_CLIENT: HttpStatus.UNPROCESSABLE_ENTITY,
      PRACTICE2D_SESSION_NOT_FOUND: HttpStatus.NOT_FOUND,
      PRACTICE2D_SESSION_UNAUTHORIZED: HttpStatus.FORBIDDEN,
      PRACTICE2D_SESSION_NOT_ACTIVE: HttpStatus.CONFLICT,
    };
    response.status(statusMap[exception.code] ?? HttpStatus.BAD_REQUEST).json({
      success: false,
      code: exception.code,
      message: exception.message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
