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
import { buildAuditRequestContext } from '@repo/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import { ActivateCourseCommand } from '../../application/use-cases/activate-course/activate-course.command';
import { ActivateCourseUseCase } from '../../application/use-cases/activate-course/activate-course.use-case';
import { AddCourseMaterialCommand } from '../../application/use-cases/add-course-material/add-course-material.command';
import { AddCourseMaterialUseCase } from '../../application/use-cases/add-course-material/add-course-material.use-case';
import { AddLessonCommand } from '../../application/use-cases/add-lesson/add-lesson.command';
import { AddLessonUseCase } from '../../application/use-cases/add-lesson/add-lesson.use-case';
import { CreateCourseCommand } from '../../application/use-cases/create-course/create-course.command';
import { CreateCourseUseCase } from '../../application/use-cases/create-course/create-course.use-case';
import { DeleteCourseCommand } from '../../application/use-cases/delete-course/delete-course.command';
import { DeleteCourseUseCase } from '../../application/use-cases/delete-course/delete-course.use-case';
import { GetCourseQuery } from '../../application/use-cases/get-course/get-course.query';
import { GetCourseUseCase } from '../../application/use-cases/get-course/get-course.use-case';
import { ListCoursesQuery } from '../../application/use-cases/list-courses/list-courses.query';
import { ListCoursesUseCase } from '../../application/use-cases/list-courses/list-courses.use-case';
import { RemoveLessonCommand } from '../../application/use-cases/remove-lesson/remove-lesson.command';
import { RemoveLessonUseCase } from '../../application/use-cases/remove-lesson/remove-lesson.use-case';
import { UpdateCourseCommand } from '../../application/use-cases/update-course/update-course.command';
import { UpdateCourseUseCase } from '../../application/use-cases/update-course/update-course.use-case';
import { AddCourseMaterialRequestDto } from '../dtos/add-course-material.request.dto';
import { AddLessonRequestDto } from '../dtos/add-lesson.request.dto';
import {
  CourseResponseDto,
  ListCoursesResponseDto,
} from '../dtos/course.response.dto';
import { CreateCourseRequestDto } from '../dtos/create-course.request.dto';
import { ListCoursesQueryDto } from '../dtos/list-courses.query.dto';
import { UpdateCourseRequestDto } from '../dtos/update-course.request.dto';

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
