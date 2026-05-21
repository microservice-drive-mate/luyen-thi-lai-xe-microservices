import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import { EnrollStudentCommand } from '../../application/use-cases/enroll-student/enroll-student.command';
import { EnrollStudentUseCase } from '../../application/use-cases/enroll-student/enroll-student.use-case';
import { GetCourseQuery } from '../../application/use-cases/get-course/get-course.query';
import { GetCourseUseCase } from '../../application/use-cases/get-course/get-course.use-case';
import { ListCoursesQuery } from '../../application/use-cases/list-courses/list-courses.query';
import { ListCoursesUseCase } from '../../application/use-cases/list-courses/list-courses.use-case';
import {
  CourseResponseDto,
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
}
