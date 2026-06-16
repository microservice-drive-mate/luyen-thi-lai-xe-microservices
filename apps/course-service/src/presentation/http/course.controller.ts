import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Query,
} from '@nestjs/common';
import { buildAuditRequestContext } from '@repo/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import { EnrollStudentCommand } from '../../application/use-cases/enroll-student/enroll-student.command';
import { EnrollStudentUseCase } from '../../application/use-cases/enroll-student/enroll-student.use-case';
import { GetCourseQuery } from '../../application/use-cases/get-course/get-course.query';
import { GetCourseUseCase } from '../../application/use-cases/get-course/get-course.use-case';
import { GetLessonQuery } from '../../application/use-cases/get-lesson/get-lesson.query';
import { GetLessonUseCase } from '../../application/use-cases/get-lesson/get-lesson.use-case';
import { ListCoursesQuery } from '../../application/use-cases/list-courses/list-courses.query';
import { ListCoursesUseCase } from '../../application/use-cases/list-courses/list-courses.use-case';
import { UnenrollStudentCommand } from '../../application/use-cases/unenroll-student/unenroll-student.command';
import { UnenrollStudentUseCase } from '../../application/use-cases/unenroll-student/unenroll-student.use-case';
import {
  CourseResponseDto,
  LessonResponseDto,
  ListCoursesResponseDto,
} from '../dtos/course.response.dto';
import { EnrollmentResponseDto } from '../dtos/enrollment.response.dto';
import { ListCoursesQueryDto } from '../dtos/list-courses.query.dto';

interface JwtPayload {
  sub?: string;
}

function resolveActorId(user: JwtPayload | undefined, headerUserId?: string) {
  return user?.sub ?? headerUserId ?? '';
}

@ApiTags('Courses')
@ApiBearerAuth()
@Controller('courses')
export class CourseController {
  constructor(
    private readonly getCourseUseCase: GetCourseUseCase,
    private readonly listCoursesUseCase: ListCoursesUseCase,
    private readonly enrollStudentUseCase: EnrollStudentUseCase,
    private readonly unenrollStudentUseCase: UnenrollStudentUseCase,
    private readonly getLessonUseCase: GetLessonUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List courses' })
  async listCourses(
    @Query() query: ListCoursesQueryDto,
  ): Promise<ListCoursesResponseDto> {
    const result = await this.listCoursesUseCase.execute(
      new ListCoursesQuery(
        query.page ?? 1,
        query.size ?? 20,
        query.licenseCategory,
        query.status,
      ),
    );
    return ListCoursesResponseDto.fromResult(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get course detail' })
  async getCourse(@Param('id') id: string): Promise<CourseResponseDto> {
    const result = await this.getCourseUseCase.execute(new GetCourseQuery(id));
    return CourseResponseDto.fromResult(result);
  }

  @Get(':id/lessons/:lessonId')
  @Roles({ roles: ['realm:STUDENT', 'realm:INSTRUCTOR'] })
  @ApiOperation({ summary: 'Get course lesson detail' })
  async getLesson(
    @Param('id') courseId: string,
    @Param('lessonId') lessonId: string,
  ): Promise<LessonResponseDto> {
    const result = await this.getLessonUseCase.execute(
      new GetLessonQuery(courseId, lessonId),
    );
    return LessonResponseDto.fromResult(result);
  }

  @Post(':id/enroll')
  @Roles({ roles: ['realm:STUDENT'] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Enroll current student in course' })
  async enroll(
    @Param('id') courseId: string,
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
  ): Promise<EnrollmentResponseDto> {
    const result = await this.enrollStudentUseCase.execute(
      new EnrollStudentCommand(courseId, resolveActorId(user, headerUserId)),
    );
    return EnrollmentResponseDto.fromResult(result);
  }

  @Post(':id/unenroll')
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({ summary: 'Unenroll current student from course' })
  async unenroll(
    @Param('id') courseId: string,
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
    @Req() request: Request,
  ): Promise<EnrollmentResponseDto> {
    const studentId = resolveActorId(user, headerUserId);
    const result = await this.unenrollStudentUseCase.execute(
      new UnenrollStudentCommand(
        courseId,
        studentId,
        buildAuditRequestContext(request, user),
      ),
    );
    return EnrollmentResponseDto.fromResult(result);
  }
}
