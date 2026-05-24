import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { buildAuditRequestContext } from '@repo/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import { CompleteLessonCommand } from '../../application/use-cases/complete-lesson/complete-lesson.command';
import { CompleteLessonUseCase } from '../../application/use-cases/complete-lesson/complete-lesson.use-case';
import { GetEnrollmentQuery } from '../../application/use-cases/get-enrollment/get-enrollment.query';
import { GetEnrollmentUseCase } from '../../application/use-cases/get-enrollment/get-enrollment.use-case';
import { ListStudentEnrollmentsQuery } from '../../application/use-cases/list-student-enrollments/list-student-enrollments.query';
import { ListStudentEnrollmentsUseCase } from '../../application/use-cases/list-student-enrollments/list-student-enrollments.use-case';
import { ResetEnrollmentProgressCommand } from '../../application/use-cases/reset-enrollment-progress/reset-enrollment-progress.command';
import { ResetEnrollmentProgressUseCase } from '../../application/use-cases/reset-enrollment-progress/reset-enrollment-progress.use-case';
import {
  EnrollmentResponseDto,
  ListEnrollmentsResponseDto,
} from '../dtos/enrollment.response.dto';
import { ListEnrollmentsQueryDto } from '../dtos/list-enrollments.query.dto';

interface JwtPayload {
  sub?: string;
}

function resolveActorId(user: JwtPayload | undefined, headerUserId?: string) {
  return user?.sub ?? headerUserId ?? '';
}

@ApiTags('Enrollments')
@ApiBearerAuth()
@Controller('enrollments')
export class EnrollmentController {
  constructor(
    private readonly getEnrollmentUseCase: GetEnrollmentUseCase,
    private readonly listStudentEnrollmentsUseCase: ListStudentEnrollmentsUseCase,
    private readonly completeLessonUseCase: CompleteLessonUseCase,
    private readonly resetEnrollmentProgressUseCase: ResetEnrollmentProgressUseCase,
  ) {}

  @Get()
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({ summary: 'List enrollments of the current student' })
  async listEnrollments(
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
    @Query() query: ListEnrollmentsQueryDto,
  ): Promise<ListEnrollmentsResponseDto> {
    const result = await this.listStudentEnrollmentsUseCase.execute(
      new ListStudentEnrollmentsQuery(
        resolveActorId(user, headerUserId),
        query.page ?? 1,
        query.size ?? 20,
        query.status,
      ),
    );
    return ListEnrollmentsResponseDto.fromResult(result);
  }

  @Get(':id')
  @Roles({ roles: ['realm:STUDENT', 'realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @ApiOperation({ summary: 'Get enrollment detail' })
  async getEnrollment(@Param('id') id: string): Promise<EnrollmentResponseDto> {
    const result = await this.getEnrollmentUseCase.execute(
      new GetEnrollmentQuery(id),
    );
    return EnrollmentResponseDto.fromResult(result);
  }

  @Post(':id/lessons/:lessonId/complete')
  @Roles({ roles: ['realm:STUDENT'] })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark lesson as completed' })
  async completeLesson(
    @Param('id') enrollmentId: string,
    @Param('lessonId') lessonId: string,
  ): Promise<EnrollmentResponseDto> {
    const result = await this.completeLessonUseCase.execute(
      new CompleteLessonCommand(enrollmentId, lessonId),
    );
    return EnrollmentResponseDto.fromResult(result);
  }

  @Post(':id/reset-progress')
  @Roles({ roles: ['realm:STUDENT'] })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset current student enrollment progress' })
  async resetProgress(
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
    @Param('id') enrollmentId: string,
    @Req() request: Request,
  ): Promise<EnrollmentResponseDto> {
    const actorId = resolveActorId(user, headerUserId);
    const result = await this.resetEnrollmentProgressUseCase.execute(
      new ResetEnrollmentProgressCommand(
        enrollmentId,
        actorId,
        buildAuditRequestContext(request, user),
      ),
    );
    return EnrollmentResponseDto.fromResult(result);
  }
}
