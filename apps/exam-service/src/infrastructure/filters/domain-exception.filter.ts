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
      EXAM_TEMPLATE_NOT_FOUND: HttpStatus.NOT_FOUND,
      EXAM_SESSION_NOT_FOUND: HttpStatus.NOT_FOUND,
      EXAM_SESSION_QUESTION_NOT_FOUND: HttpStatus.NOT_FOUND,
      EXAM_TEMPLATE_VERSION_CONFLICT: HttpStatus.CONFLICT,
      EXAM_TEMPLATE_IN_USE: HttpStatus.CONFLICT,
      EXAM_SESSION_ALREADY_FINISHED: HttpStatus.CONFLICT,
      EXAM_SESSION_EXPIRED: HttpStatus.CONFLICT,
      EXAM_SESSION_UNAUTHORIZED: HttpStatus.FORBIDDEN,
      STUDENT_LICENSE_MISMATCH: HttpStatus.FORBIDDEN,
      STUDENT_PROFILE_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
      EXAM_TEMPLATE_INACTIVE: HttpStatus.UNPROCESSABLE_ENTITY,
      EXAM_SESSION_NOT_FINISHED: HttpStatus.UNPROCESSABLE_ENTITY,
      INSUFFICIENT_QUESTION_POOL: HttpStatus.UNPROCESSABLE_ENTITY,
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
