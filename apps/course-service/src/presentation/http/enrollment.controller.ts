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
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompleteLessonCommand } from '../../application/use-cases/complete-lesson/complete-lesson.command';
import { CompleteLessonUseCase } from '../../application/use-cases/complete-lesson/complete-lesson.use-case';
import { GetEnrollmentQuery } from '../../application/use-cases/get-enrollment/get-enrollment.query';
import { GetEnrollmentUseCase } from '../../application/use-cases/get-enrollment/get-enrollment.use-case';
import { ListStudentEnrollmentsQuery } from '../../application/use-cases/list-student-enrollments/list-student-enrollments.query';
import { ListStudentEnrollmentsUseCase } from '../../application/use-cases/list-student-enrollments/list-student-enrollments.use-case';
import {
  EnrollmentResponseDto,
  ListEnrollmentsResponseDto,
} from '../dtos/enrollment.response.dto';
import { ListEnrollmentsQueryDto } from '../dtos/list-enrollments.query.dto';

@ApiTags('Enrollments')
@Controller('enrollments')
export class EnrollmentController {
  constructor(
    private readonly getEnrollmentUseCase: GetEnrollmentUseCase,
    private readonly listStudentEnrollmentsUseCase: ListStudentEnrollmentsUseCase,
    private readonly completeLessonUseCase: CompleteLessonUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách đăng ký của student hiện tại' })
  @ApiHeader({
    name: 'x-user-id',
    description: 'ID của student (inject bởi Kong)',
    required: true,
  })
  async listEnrollments(
    @Headers('x-user-id') studentId: string,
    @Query() query: ListEnrollmentsQueryDto,
  ): Promise<ListEnrollmentsResponseDto> {
    const result = await this.listStudentEnrollmentsUseCase.execute(
      new ListStudentEnrollmentsQuery(
        studentId,
        query.page ?? 1,
        query.size ?? 20,
        query.status,
      ),
    );
    return ListEnrollmentsResponseDto.fromResult(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết enrollment và tiến độ học' })
  async getEnrollment(@Param('id') id: string): Promise<EnrollmentResponseDto> {
    const result = await this.getEnrollmentUseCase.execute(
      new GetEnrollmentQuery(id),
    );
    return EnrollmentResponseDto.fromResult(result);
  }

  @Post(':id/lessons/:lessonId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu hoàn thành bài học' })
  async completeLesson(
    @Param('id') enrollmentId: string,
    @Param('lessonId') lessonId: string,
  ): Promise<EnrollmentResponseDto> {
    const result = await this.completeLessonUseCase.execute(
      new CompleteLessonCommand(enrollmentId, lessonId),
    );
    return EnrollmentResponseDto.fromResult(result);
  }
}
