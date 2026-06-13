import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CourseScheduleResult } from '../../application/use-cases/shared/course-schedule.result';

export class CourseScheduleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() courseId!: string;
  @ApiProperty() instructorId!: string;
  @ApiProperty() dayOfWeek!: number;
  @ApiProperty() startTime!: string;
  @ApiProperty() endTime!: string;
  @ApiPropertyOptional({ nullable: true }) room!: string | null;
  @ApiProperty() effectiveFrom!: Date;
  @ApiPropertyOptional({ nullable: true }) effectiveTo!: Date | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;

  static fromResult(result: CourseScheduleResult): CourseScheduleResponseDto {
    return Object.assign(new CourseScheduleResponseDto(), result);
  }
}
