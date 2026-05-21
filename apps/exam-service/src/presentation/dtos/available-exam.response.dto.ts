import { ApiProperty } from '@nestjs/swagger';
import {
  AvailableExamResult,
  ListAvailableExamsResult,
} from '../../application/use-cases/list-available-exams/list-available-exams.result';
import { LicenseCategory } from '../../domain/aggregates/exam-template/exam-template.types';

export class AvailableExamResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ enum: LicenseCategory }) licenseCategory: LicenseCategory;
  @ApiProperty() totalQuestions: number;
  @ApiProperty() passingScore: number;
  @ApiProperty() durationMinutes: number;
  @ApiProperty() criticalQuestions: number;
  @ApiProperty() maxCriticalMistakes: number;
  @ApiProperty() shuffleQuestions: boolean;

  static fromResult(result: AvailableExamResult): AvailableExamResponseDto {
    const dto = new AvailableExamResponseDto();
    dto.id = result.id;
    dto.name = result.name;
    dto.description = result.description;
    dto.licenseCategory = result.licenseCategory;
    dto.totalQuestions = result.totalQuestions;
    dto.passingScore = result.passingScore;
    dto.durationMinutes = result.durationMinutes;
    dto.criticalQuestions = result.criticalQuestions;
    dto.maxCriticalMistakes = result.maxCriticalMistakes;
    dto.shuffleQuestions = result.shuffleQuestions;
    return dto;
  }
}

export class ListAvailableExamsResponseDto {
  @ApiProperty({ type: [AvailableExamResponseDto] })
  items: AvailableExamResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() size: number;

  static fromResult(
    result: ListAvailableExamsResult,
  ): ListAvailableExamsResponseDto {
    const dto = new ListAvailableExamsResponseDto();
    dto.items = result.items.map(AvailableExamResponseDto.fromResult);
    dto.total = result.total;
    dto.page = result.page;
    dto.size = result.size;
    return dto;
  }
}
