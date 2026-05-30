import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { DomainException, extractErrorCode } from '@repo/common';
import { Request, Response } from 'express';

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusMap: Record<string, number> = {
      QUESTION_NOT_FOUND: HttpStatus.NOT_FOUND,
      QUESTION_TOPIC_NOT_FOUND: HttpStatus.NOT_FOUND,
      QUESTION_DUPLICATE: HttpStatus.CONFLICT,
      QUESTION_VERSION_CONFLICT: HttpStatus.CONFLICT,
      QUESTION_ALREADY_DELETED: HttpStatus.UNPROCESSABLE_ENTITY,
      INVALID_QUESTION: HttpStatus.BAD_REQUEST,
    };

    const status = statusMap[exception.code] ?? HttpStatus.BAD_REQUEST;

    response.status(status).json({
      success: false,
      code: exception.code,
      message: exception.message,
      errorCode: extractErrorCode(exception.message),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
