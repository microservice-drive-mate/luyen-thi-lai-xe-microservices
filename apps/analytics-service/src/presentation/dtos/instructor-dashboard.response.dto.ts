import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InstructorDashboard } from '../../domain/dashboard/instructor-dashboard.types';

export class InstructorDashboardPeriodDto {
  @ApiProperty() month!: string;
  @ApiProperty() weekStart!: string;
  @ApiProperty() date!: string;
  @ApiProperty() timezone!: string;
}

export class InstructorDashboardSummaryDto {
  @ApiProperty() activeClassCount!: number;
  @ApiProperty() totalStudents!: number;
  @ApiProperty() passRate!: number;
  @ApiProperty() teachingHoursThisMonth!: number;
}

export class InstructorWeeklyTeachingTrendPointDto {
  @ApiProperty() date!: string;
  @ApiProperty() label!: string;
  @ApiProperty() teachingHours!: number;
  @ApiProperty() studentCount!: number;
}

export class InstructorTopicAverageDto {
  @ApiPropertyOptional({ nullable: true }) topicId!: string | null;
  @ApiPropertyOptional({ nullable: true }) topicName!: string | null;
  @ApiProperty() averageScore!: number;
  @ApiProperty() answeredQuestions!: number;
}

export class InstructorCourseStudentDto {
  @ApiProperty() studentId!: string;
  @ApiPropertyOptional({ nullable: true }) fullName!: string | null;
  @ApiPropertyOptional({ nullable: true }) email!: string | null;
  @ApiPropertyOptional({ nullable: true }) licenseTier!: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() progress!: number;
  @ApiPropertyOptional({ nullable: true }) enrolledAt!: Date | null;
  @ApiPropertyOptional({ nullable: true }) completedAt!: Date | null;
}

export class InstructorClassProgressDto {
  @ApiProperty() courseId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() licenseCategory!: string;
  @ApiProperty() totalStudents!: number;
  @ApiProperty() completedStudents!: number;
  @ApiProperty() progressPct!: number;
  @ApiProperty({ type: () => [InstructorCourseStudentDto] })
  students!: InstructorCourseStudentDto[];
}

export class InstructorTodayScheduleItemDto {
  @ApiProperty() scheduleId!: string;
  @ApiProperty() courseId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true }) room!: string | null;
  @ApiProperty() startTime!: string;
  @ApiProperty() endTime!: string;
  @ApiProperty() studentCount!: number;
}

export class InstructorDashboardResponseDto {
  @ApiProperty({ type: InstructorDashboardPeriodDto })
  period!: InstructorDashboardPeriodDto;
  @ApiProperty({ type: InstructorDashboardSummaryDto })
  summary!: InstructorDashboardSummaryDto;
  @ApiProperty({ type: [InstructorWeeklyTeachingTrendPointDto] })
  weeklyTeachingTrend!: InstructorWeeklyTeachingTrendPointDto[];
  @ApiProperty({ type: [InstructorTopicAverageDto] })
  topicAverages!: InstructorTopicAverageDto[];
  @ApiProperty({ type: [InstructorClassProgressDto] })
  classProgress!: InstructorClassProgressDto[];
  @ApiProperty({ type: [InstructorTodayScheduleItemDto] })
  todaySchedule!: InstructorTodayScheduleItemDto[];

  static fromDashboard(
    dashboard: InstructorDashboard,
  ): InstructorDashboardResponseDto {
    return Object.assign(new InstructorDashboardResponseDto(), dashboard);
  }
}
