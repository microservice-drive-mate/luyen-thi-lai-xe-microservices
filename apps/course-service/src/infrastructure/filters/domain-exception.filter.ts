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
      COURSE_NOT_FOUND: HttpStatus.NOT_FOUND,
      LESSON_NOT_FOUND: HttpStatus.NOT_FOUND,
      ENROLLMENT_NOT_FOUND: HttpStatus.NOT_FOUND,
      ENROLLMENT_ALREADY_EXISTS: HttpStatus.CONFLICT,
      LESSON_ALREADY_COMPLETED: HttpStatus.CONFLICT,
      INSTRUCTOR_ALREADY_ASSIGNED: HttpStatus.CONFLICT,
      COURSE_NOT_ACTIVE: HttpStatus.UNPROCESSABLE_ENTITY,
      COURSE_HAS_NO_LESSON: HttpStatus.UNPROCESSABLE_ENTITY,
      ENROLLMENT_ALREADY_COMPLETED: HttpStatus.UNPROCESSABLE_ENTITY,
      COURSE_CAPACITY_EXCEEDED: HttpStatus.UNPROCESSABLE_ENTITY,
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
