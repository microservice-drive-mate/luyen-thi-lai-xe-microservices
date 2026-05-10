import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnrollmentStatus } from '../../domain/aggregates/course-enrollment/course-enrollment.types';
import {
  EnrollmentResult,
  LessonProgressResult,
  ListEnrollmentsResult,
} from '../../application/use-cases/shared/enrollment.result';

export class LessonProgressResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() lessonId: string;
  @ApiPropertyOptional() completedAt: Date | null;
  @ApiProperty() watchedSeconds: number;
  @ApiProperty() isCompleted: boolean;

  static fromResult(r: LessonProgressResult): LessonProgressResponseDto {
    const dto = new LessonProgressResponseDto();
    Object.assign(dto, r);
    return dto;
  }
}

export class EnrollmentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() courseId: string;
  @ApiProperty() studentId: string;
  @ApiProperty({ enum: EnrollmentStatus }) status: EnrollmentStatus;
  @ApiProperty() progress: number;
  @ApiProperty() enrolledAt: Date;
  @ApiPropertyOptional() completedAt: Date | null;
  @ApiProperty({ type: [LessonProgressResponseDto] })
  lessonProgress: LessonProgressResponseDto[];

  static fromResult(result: EnrollmentResult): EnrollmentResponseDto {
    const dto = new EnrollmentResponseDto();
    dto.id = result.id;
    dto.courseId = result.courseId;
    dto.studentId = result.studentId;
    dto.status = result.status;
    dto.progress = result.progress;
    dto.enrolledAt = result.enrolledAt;
    dto.completedAt = result.completedAt;
    dto.lessonProgress = result.lessonProgress.map(
      LessonProgressResponseDto.fromResult,
    );
    return dto;
  }
}

export class ListEnrollmentsResponseDto {
  @ApiProperty({ type: [EnrollmentResponseDto] })
  items: EnrollmentResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() size: number;

  static fromResult(result: ListEnrollmentsResult): ListEnrollmentsResponseDto {
    const dto = new ListEnrollmentsResponseDto();
    dto.items = result.items.map(EnrollmentResponseDto.fromResult);
    dto.total = result.total;
    dto.page = result.page;
    dto.size = result.size;
    return dto;
  }
}
