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
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActivateCourseCommand } from '../../application/use-cases/activate-course/activate-course.command';
import { ActivateCourseUseCase } from '../../application/use-cases/activate-course/activate-course.use-case';
import { AddCourseMaterialCommand } from '../../application/use-cases/add-course-material/add-course-material.command';
import { AddCourseMaterialUseCase } from '../../application/use-cases/add-course-material/add-course-material.use-case';
import { AddLessonCommand } from '../../application/use-cases/add-lesson/add-lesson.command';
import { AddLessonUseCase } from '../../application/use-cases/add-lesson/add-lesson.use-case';
import { CreateCourseCommand } from '../../application/use-cases/create-course/create-course.command';
import { CreateCourseUseCase } from '../../application/use-cases/create-course/create-course.use-case';
import { EnrollStudentCommand } from '../../application/use-cases/enroll-student/enroll-student.command';
import { EnrollStudentUseCase } from '../../application/use-cases/enroll-student/enroll-student.use-case';
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
import { EnrollmentResponseDto } from '../dtos/enrollment.response.dto';

@ApiTags('Courses')
@Controller('courses')
export class CourseController {
  constructor(
    private readonly createCourseUseCase: CreateCourseUseCase,
    private readonly updateCourseUseCase: UpdateCourseUseCase,
    private readonly activateCourseUseCase: ActivateCourseUseCase,
    private readonly addLessonUseCase: AddLessonUseCase,
    private readonly removeLessonUseCase: RemoveLessonUseCase,
    private readonly addCourseMaterialUseCase: AddCourseMaterialUseCase,
    private readonly getCourseUseCase: GetCourseUseCase,
    private readonly listCoursesUseCase: ListCoursesUseCase,
    private readonly enrollStudentUseCase: EnrollStudentUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo khóa học mới' })
  @ApiHeader({
    name: 'x-user-id',
    description: 'ID của người tạo (inject bởi Kong)',
    required: true,
  })
  async createCourse(
    @Headers('x-user-id') createdById: string,
    @Body() dto: CreateCourseRequestDto,
  ): Promise<CourseResponseDto> {
    const result = await this.createCourseUseCase.execute(
      new CreateCourseCommand(
        createdById,
        dto.title,
        dto.licenseCategory,
        dto.description,
        dto.thumbnailUrl,
        dto.duration,
        dto.tuitionFee,
        dto.capacity,
        dto.instructorIds,
        dto.requirement,
      ),
    );
    return CourseResponseDto.fromResult(result);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách khóa học (có phân trang và lọc)' })
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
  @ApiOperation({ summary: 'Chi tiết khóa học' })
  async getCourse(@Param('id') id: string): Promise<CourseResponseDto> {
    const result = await this.getCourseUseCase.execute(new GetCourseQuery(id));
    return CourseResponseDto.fromResult(result);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật khóa học' })
  async updateCourse(
    @Param('id') id: string,
    @Body() dto: UpdateCourseRequestDto,
  ): Promise<CourseResponseDto> {
    const result = await this.updateCourseUseCase.execute(
      new UpdateCourseCommand(
        id,
        dto.title,
        dto.description,
        dto.thumbnailUrl,
        dto.duration,
        dto.tuitionFee,
        dto.capacity,
        dto.requirement,
      ),
    );
    return CourseResponseDto.fromResult(result);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Kích hoạt khóa học (DRAFT → ACTIVE)' })
  async activateCourse(@Param('id') id: string): Promise<CourseResponseDto> {
    const result = await this.activateCourseUseCase.execute(
      new ActivateCourseCommand(id),
    );
    return CourseResponseDto.fromResult(result);
  }

  @Post(':id/lessons')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Thêm bài học vào khóa học' })
  async addLesson(
    @Param('id') courseId: string,
    @Body() dto: AddLessonRequestDto,
  ): Promise<CourseResponseDto> {
    const result = await this.addLessonUseCase.execute(
      new AddLessonCommand(
        courseId,
        dto.title,
        dto.order,
        dto.content,
        dto.videoUrl,
        dto.durationMinutes,
      ),
    );
    return CourseResponseDto.fromResult(result);
  }

  @Delete(':id/lessons/:lessonId')
  @ApiOperation({ summary: 'Xóa bài học khỏi khóa học' })
  async removeLesson(
    @Param('id') courseId: string,
    @Param('lessonId') lessonId: string,
  ): Promise<CourseResponseDto> {
    const result = await this.removeLessonUseCase.execute(
      new RemoveLessonCommand(courseId, lessonId),
    );
    return CourseResponseDto.fromResult(result);
  }

  @Post(':id/materials')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Thêm tài liệu học tập' })
  async addMaterial(
    @Param('id') courseId: string,
    @Body() dto: AddCourseMaterialRequestDto,
  ): Promise<CourseResponseDto> {
    const result = await this.addCourseMaterialUseCase.execute(
      new AddCourseMaterialCommand(courseId, dto.title, dto.fileUrl, dto.type),
    );
    return CourseResponseDto.fromResult(result);
  }

  @Post(':id/enroll')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đăng ký khóa học (student tự đăng ký)' })
  @ApiHeader({
    name: 'x-user-id',
    description: 'ID của student (inject bởi Kong)',
    required: true,
  })
  async enroll(
    @Param('id') courseId: string,
    @Headers('x-user-id') studentId: string,
  ): Promise<EnrollmentResponseDto> {
    const result = await this.enrollStudentUseCase.execute(
      new EnrollStudentCommand(courseId, studentId),
    );
    return EnrollmentResponseDto.fromResult(result);
  }
}
