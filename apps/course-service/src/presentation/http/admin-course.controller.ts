import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { buildAuditRequestContext } from '@repo/common';
import type { Request } from 'express';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import { ActivateCourseCommand } from '../../application/use-cases/activate-course/activate-course.command';
import { ActivateCourseUseCase } from '../../application/use-cases/activate-course/activate-course.use-case';
import { AddCourseMaterialCommand } from '../../application/use-cases/add-course-material/add-course-material.command';
import { AddCourseMaterialUseCase } from '../../application/use-cases/add-course-material/add-course-material.use-case';
import { AddLessonCommand } from '../../application/use-cases/add-lesson/add-lesson.command';
import { AddLessonUseCase } from '../../application/use-cases/add-lesson/add-lesson.use-case';
import { AssignCourseInstructorCommand } from '../../application/use-cases/assign-course-instructor/assign-course-instructor.command';
import { AssignCourseInstructorUseCase } from '../../application/use-cases/assign-course-instructor/assign-course-instructor.use-case';
import { CreateCourseCommand } from '../../application/use-cases/create-course/create-course.command';
import { CreateCourseUseCase } from '../../application/use-cases/create-course/create-course.use-case';
import { CreateCourseScheduleCommand } from '../../application/use-cases/create-course-schedule/create-course-schedule.command';
import { CreateCourseScheduleUseCase } from '../../application/use-cases/create-course-schedule/create-course-schedule.use-case';
import { DeleteCourseCommand } from '../../application/use-cases/delete-course/delete-course.command';
import { DeleteCourseUseCase } from '../../application/use-cases/delete-course/delete-course.use-case';
import { DeleteCourseScheduleCommand } from '../../application/use-cases/delete-course-schedule/delete-course-schedule.command';
import { DeleteCourseScheduleUseCase } from '../../application/use-cases/delete-course-schedule/delete-course-schedule.use-case';
import { GetCourseQuery } from '../../application/use-cases/get-course/get-course.query';
import { GetCourseUseCase } from '../../application/use-cases/get-course/get-course.use-case';
import { ListCourseSchedulesQuery } from '../../application/use-cases/list-course-schedules/list-course-schedules.query';
import { ListCourseSchedulesUseCase } from '../../application/use-cases/list-course-schedules/list-course-schedules.use-case';
import { ListCoursesQuery } from '../../application/use-cases/list-courses/list-courses.query';
import { ListCoursesUseCase } from '../../application/use-cases/list-courses/list-courses.use-case';
import { RemoveCourseInstructorCommand } from '../../application/use-cases/remove-course-instructor/remove-course-instructor.command';
import { RemoveCourseInstructorUseCase } from '../../application/use-cases/remove-course-instructor/remove-course-instructor.use-case';
import { RemoveLessonCommand } from '../../application/use-cases/remove-lesson/remove-lesson.command';
import { RemoveLessonUseCase } from '../../application/use-cases/remove-lesson/remove-lesson.use-case';
import { UpdateCourseCommand } from '../../application/use-cases/update-course/update-course.command';
import { UpdateCourseUseCase } from '../../application/use-cases/update-course/update-course.use-case';
import { UpdateCourseScheduleCommand } from '../../application/use-cases/update-course-schedule/update-course-schedule.command';
import { UpdateCourseScheduleUseCase } from '../../application/use-cases/update-course-schedule/update-course-schedule.use-case';
import { UpdateLessonCommand } from '../../application/use-cases/update-lesson/update-lesson.command';
import { UpdateLessonUseCase } from '../../application/use-cases/update-lesson/update-lesson.use-case';
import { AddCourseMaterialRequestDto } from '../dtos/add-course-material.request.dto';
import { AddLessonRequestDto } from '../dtos/add-lesson.request.dto';
import { AssignCourseInstructorRequestDto } from '../dtos/assign-course-instructor.request.dto';
import {
  CourseResponseDto,
  ListCoursesResponseDto,
} from '../dtos/course.response.dto';
import {
  CreateCourseScheduleRequestDto,
  UpdateCourseScheduleRequestDto,
} from '../dtos/course-schedule.request.dto';
import { CourseScheduleResponseDto } from '../dtos/course-schedule.response.dto';
import { CreateCourseRequestDto } from '../dtos/create-course.request.dto';
import { ListCoursesQueryDto } from '../dtos/list-courses.query.dto';
import { UpdateCourseRequestDto } from '../dtos/update-course.request.dto';
import { UpdateLessonRequestDto } from '../dtos/update-lesson.request.dto';

interface JwtPayload {
  sub?: string;
}

function resolveActorId(user: JwtPayload | undefined, headerUserId?: string) {
  return user?.sub ?? headerUserId ?? '';
}

const COURSE_ADMIN_ROLES = [
  'realm:ADMIN',
  'realm:CENTER_MANAGER',
  'realm:INSTRUCTOR',
];

@ApiTags('Admin Courses')
@ApiBearerAuth()
@Controller('admin/courses')
export class AdminCourseController {
  constructor(
    private readonly createCourseUseCase: CreateCourseUseCase,
    private readonly updateCourseUseCase: UpdateCourseUseCase,
    private readonly activateCourseUseCase: ActivateCourseUseCase,
    private readonly addLessonUseCase: AddLessonUseCase,
    private readonly removeLessonUseCase: RemoveLessonUseCase,
    private readonly addCourseMaterialUseCase: AddCourseMaterialUseCase,
    private readonly getCourseUseCase: GetCourseUseCase,
    private readonly listCoursesUseCase: ListCoursesUseCase,
    private readonly deleteCourseUseCase: DeleteCourseUseCase,
    private readonly createCourseScheduleUseCase: CreateCourseScheduleUseCase,
    private readonly updateCourseScheduleUseCase: UpdateCourseScheduleUseCase,
    private readonly deleteCourseScheduleUseCase: DeleteCourseScheduleUseCase,
    private readonly listCourseSchedulesUseCase: ListCourseSchedulesUseCase,
    private readonly updateLessonUseCase: UpdateLessonUseCase,
    private readonly assignCourseInstructorUseCase: AssignCourseInstructorUseCase,
    private readonly removeCourseInstructorUseCase: RemoveCourseInstructorUseCase,
  ) {}

  @Post()
  @Roles({ roles: COURSE_ADMIN_ROLES })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create course' })
  async createCourse(
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
    @Body() dto: CreateCourseRequestDto,
    @Req() request: Request,
  ): Promise<CourseResponseDto> {
    const actorId = resolveActorId(user, headerUserId);
    const result = await this.createCourseUseCase.execute(
      new CreateCourseCommand(
        actorId,
        dto.courseCode,
        dto.title,
        dto.licenseCategory,
        dto.description,
        dto.duration,
        dto.tuitionFee,
        dto.capacity,
        dto.instructorIds,
        dto.requirement,
        buildAuditRequestContext(request, user),
      ),
    );
    return CourseResponseDto.fromResult(result);
  }

  @Get()
  @Roles({ roles: COURSE_ADMIN_ROLES })
  @ApiOperation({ summary: 'List courses for admin dashboard' })
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
  @Roles({ roles: COURSE_ADMIN_ROLES })
  @ApiOperation({ summary: 'Get course detail for admin dashboard' })
  async getCourse(@Param('id') id: string): Promise<CourseResponseDto> {
    const result = await this.getCourseUseCase.execute(new GetCourseQuery(id));
    return CourseResponseDto.fromResult(result);
  }

  @Get(':id/schedules')
  @Roles({ roles: COURSE_ADMIN_ROLES })
  @ApiOperation({ summary: 'List course teaching schedules' })
  async listSchedules(
    @Param('id') courseId: string,
  ): Promise<CourseScheduleResponseDto[]> {
    const result = await this.listCourseSchedulesUseCase.execute(
      new ListCourseSchedulesQuery(courseId),
    );
    return result.map(CourseScheduleResponseDto.fromResult);
  }

  @Post(':id/schedules')
  @Roles({ roles: COURSE_ADMIN_ROLES })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create course teaching schedule' })
  async createSchedule(
    @Param('id') courseId: string,
    @Body() dto: CreateCourseScheduleRequestDto,
  ): Promise<CourseScheduleResponseDto> {
    const result = await this.createCourseScheduleUseCase.execute(
      new CreateCourseScheduleCommand(
        courseId,
        dto.instructorId,
        dto.dayOfWeek,
        dto.startTime,
        dto.endTime,
        dto.room ?? null,
        new Date(`${dto.effectiveFrom}T00:00:00.000Z`),
        dto.effectiveTo ? new Date(`${dto.effectiveTo}T00:00:00.000Z`) : null,
      ),
    );
    return CourseScheduleResponseDto.fromResult(result);
  }

  @Patch(':id/schedules/:scheduleId')
  @Roles({ roles: COURSE_ADMIN_ROLES })
  @ApiOperation({ summary: 'Update course teaching schedule' })
  async updateSchedule(
    @Param('id') courseId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateCourseScheduleRequestDto,
  ): Promise<CourseScheduleResponseDto> {
    const result = await this.updateCourseScheduleUseCase.execute(
      new UpdateCourseScheduleCommand(
        courseId,
        scheduleId,
        dto.instructorId,
        dto.dayOfWeek,
        dto.startTime,
        dto.endTime,
        dto.room,
        dto.effectiveFrom
          ? new Date(`${dto.effectiveFrom}T00:00:00.000Z`)
          : undefined,
        dto.effectiveTo !== undefined && dto.effectiveTo !== null
          ? new Date(`${dto.effectiveTo}T00:00:00.000Z`)
          : dto.effectiveTo,
        dto.isActive,
      ),
    );
    return CourseScheduleResponseDto.fromResult(result);
  }

  @Delete(':id/schedules/:scheduleId')
  @Roles({ roles: COURSE_ADMIN_ROLES })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete course teaching schedule' })
  async deleteSchedule(
    @Param('id') courseId: string,
    @Param('scheduleId') scheduleId: string,
  ): Promise<void> {
    await this.deleteCourseScheduleUseCase.execute(
      new DeleteCourseScheduleCommand(courseId, scheduleId),
    );
  }

  @Patch(':id')
  @Roles({ roles: COURSE_ADMIN_ROLES })
  @ApiOperation({ summary: 'Update course' })
  async updateCourse(
    @Param('id') id: string,
    @Body() dto: UpdateCourseRequestDto,
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
    @Req() request: Request,
  ): Promise<CourseResponseDto> {
    const actorId = resolveActorId(user, headerUserId);
    const result = await this.updateCourseUseCase.execute(
      new UpdateCourseCommand(
        id,
        dto.title,
        dto.description,
        dto.duration,
        dto.tuitionFee,
        dto.capacity,
        dto.requirement,
        actorId,
        buildAuditRequestContext(request, user),
        dto.version,
      ),
    );
    return CourseResponseDto.fromResult(result);
  }

  @Patch(':id/activate')
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @ApiOperation({ summary: 'Activate course' })
  async activateCourse(
    @Param('id') id: string,
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
    @Req() request: Request,
  ): Promise<CourseResponseDto> {
    const actorId = resolveActorId(user, headerUserId);
    const result = await this.activateCourseUseCase.execute(
      new ActivateCourseCommand(
        id,
        actorId,
        buildAuditRequestContext(request, user),
      ),
    );
    return CourseResponseDto.fromResult(result);
  }

  @Post(':id/lessons')
  @Roles({ roles: COURSE_ADMIN_ROLES })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add lesson to course' })
  async addLesson(
    @Param('id') courseId: string,
    @Body() dto: AddLessonRequestDto,
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
    @Req() request: Request,
  ): Promise<CourseResponseDto> {
    const actorId = resolveActorId(user, headerUserId);
    const result = await this.addLessonUseCase.execute(
      new AddLessonCommand(
        courseId,
        dto.title,
        dto.order,
        dto.content,
        actorId,
        buildAuditRequestContext(request, user),
      ),
    );
    return CourseResponseDto.fromResult(result);
  }

  @Delete(':id/lessons/:lessonId')
  @Roles({ roles: COURSE_ADMIN_ROLES })
  @ApiOperation({ summary: 'Remove lesson from course' })
  async removeLesson(
    @Param('id') courseId: string,
    @Param('lessonId') lessonId: string,
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
    @Req() request: Request,
  ): Promise<CourseResponseDto> {
    const actorId = resolveActorId(user, headerUserId);
    const result = await this.removeLessonUseCase.execute(
      new RemoveLessonCommand(
        courseId,
        lessonId,
        actorId,
        buildAuditRequestContext(request, user),
      ),
    );
    return CourseResponseDto.fromResult(result);
  }

  @Patch(':id/lessons/:lessonId')
  @Roles({ roles: COURSE_ADMIN_ROLES })
  @ApiOperation({ summary: 'Update course lesson' })
  async updateLesson(
    @Param('id') courseId: string,
    @Param('lessonId') lessonId: string,
    @Body() dto: UpdateLessonRequestDto,
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
    @Req() request: Request,
  ): Promise<CourseResponseDto> {
    const actorId = resolveActorId(user, headerUserId);
    const result = await this.updateLessonUseCase.execute(
      new UpdateLessonCommand(
        courseId,
        lessonId,
        dto.title,
        dto.order,
        dto.content,
        actorId,
        buildAuditRequestContext(request, user),
      ),
    );
    return CourseResponseDto.fromResult(result);
  }

  @Post(':id/instructors')
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign instructor to course' })
  async assignInstructor(
    @Param('id') courseId: string,
    @Body() dto: AssignCourseInstructorRequestDto,
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
    @Req() request: Request,
  ): Promise<CourseResponseDto> {
    const actorId = resolveActorId(user, headerUserId);
    const result = await this.assignCourseInstructorUseCase.execute(
      new AssignCourseInstructorCommand(
        courseId,
        dto.instructorId,
        actorId,
        buildAuditRequestContext(request, user),
      ),
    );
    return CourseResponseDto.fromResult(result);
  }

  @Delete(':id/instructors/:userId')
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @ApiOperation({ summary: 'Remove instructor from course' })
  async removeInstructor(
    @Param('id') courseId: string,
    @Param('userId') instructorId: string,
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
    @Req() request: Request,
  ): Promise<CourseResponseDto> {
    const actorId = resolveActorId(user, headerUserId);
    const result = await this.removeCourseInstructorUseCase.execute(
      new RemoveCourseInstructorCommand(
        courseId,
        instructorId,
        actorId,
        buildAuditRequestContext(request, user),
      ),
    );
    return CourseResponseDto.fromResult(result);
  }

  @Post(':id/materials')
  @Roles({ roles: COURSE_ADMIN_ROLES })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add course material' })
  async addMaterial(
    @Param('id') courseId: string,
    @Body() dto: AddCourseMaterialRequestDto,
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
    @Req() request: Request,
  ): Promise<CourseResponseDto> {
    const actorId = resolveActorId(user, headerUserId);
    const result = await this.addCourseMaterialUseCase.execute(
      new AddCourseMaterialCommand(
        courseId,
        dto.title,
        dto.fileUrl,
        dto.mediaFileId,
        dto.type,
        actorId,
        buildAuditRequestContext(request, user),
      ),
    );
    return CourseResponseDto.fromResult(result);
  }

  @Delete(':id')
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @ApiOperation({ summary: 'Archive course' })
  async deleteCourse(
    @Param('id') id: string,
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
    @Req() request: Request,
  ): Promise<CourseResponseDto> {
    const actorId = resolveActorId(user, headerUserId);
    const result = await this.deleteCourseUseCase.execute(
      new DeleteCourseCommand(
        id,
        actorId,
        buildAuditRequestContext(request, user),
      ),
    );
    return CourseResponseDto.fromResult(result);
  }
}
