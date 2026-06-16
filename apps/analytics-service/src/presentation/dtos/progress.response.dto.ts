import { ApiProperty } from '@nestjs/swagger';
import { ProgressDashboard } from '../../domain/repositories/learning-progress.repository';

export class ProgressTrendDto {
  @ApiProperty() date!: string;
  @ApiProperty() attempts!: number;
  @ApiProperty() correctAnswers!: number;
  @ApiProperty() questionsAnswered!: number;
}

export class WeakTopicDto {
  @ApiProperty({ nullable: true }) topicId!: string | null;
  @ApiProperty({ nullable: true }) topicName!: string | null;
  @ApiProperty() incorrectCount!: number;
  @ApiProperty() accuracyRate!: number;
}

export class ProgressResponseDto {
  @ApiProperty() studentId!: string;
  @ApiProperty() completionPct!: number;
  @ApiProperty() studiedCount!: number;
  @ApiProperty() attemptCount!: number;
  @ApiProperty() passRate!: number;
  @ApiProperty() totalStudyMinutes!: number;
  @ApiProperty() avgExamScore!: number;
  @ApiProperty({ type: [ProgressTrendDto] }) trend!: ProgressTrendDto[];
  @ApiProperty({ type: [WeakTopicDto] }) weakTopics!: WeakTopicDto[];
  @ApiProperty({ nullable: true }) lastActivityAt!: Date | null;

  static fromDashboard(result: ProgressDashboard): ProgressResponseDto {
    return Object.assign(new ProgressResponseDto(), result);
  }
}

export class WeakTopicsResponseDto {
  @ApiProperty({ type: [WeakTopicDto] })
  items!: WeakTopicDto[];
}

export class StudyStreakResponseDto {
  @ApiProperty() currentStreakDays!: number;
  @ApiProperty() longestWindowDays!: number;
  @ApiProperty({ nullable: true }) lastActivityDate!: string | null;
}
