import { ApiProperty } from '@nestjs/swagger';
import {
  ExamTemplateResult,
  ListExamTemplatesResult,
} from '../../application/use-cases/shared/exam-template.result';
import {
  ExamTopicDistributionItem,
  LicenseCategory,
} from '../../domain/aggregates/exam-template/exam-template.types';

export class TopicDistributionItemResponseDto {
  @ApiProperty() topicId: string;
  @ApiProperty() questionCount: number;

  static fromResult(
    result: ExamTopicDistributionItem,
  ): TopicDistributionItemResponseDto {
    const dto = new TopicDistributionItemResponseDto();
    dto.topicId = result.topicId;
    dto.questionCount = result.questionCount;
    return dto;
  }
}

export class ExamTemplateResponseDto {
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
  @ApiProperty({ type: [TopicDistributionItemResponseDto] })
  topicDistribution: TopicDistributionItemResponseDto[];
  @ApiProperty() isActive: boolean;
  @ApiProperty() isDeleted: boolean;
  @ApiProperty() version: number;
  @ApiProperty() createdById: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromResult(result: ExamTemplateResult): ExamTemplateResponseDto {
    const dto = new ExamTemplateResponseDto();
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
    dto.topicDistribution = result.topicDistribution.map(
      TopicDistributionItemResponseDto.fromResult,
    );
    dto.isActive = result.isActive;
    dto.isDeleted = result.isDeleted;
    dto.version = result.version;
    dto.createdById = result.createdById;
    dto.createdAt = result.createdAt;
    dto.updatedAt = result.updatedAt;
    return dto;
  }
}

export class ListExamTemplatesResponseDto {
  @ApiProperty({ type: [ExamTemplateResponseDto] })
  items: ExamTemplateResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() size: number;

  static fromResult(
    result: ListExamTemplatesResult,
  ): ListExamTemplatesResponseDto {
    const dto = new ListExamTemplatesResponseDto();
    dto.items = result.items.map(ExamTemplateResponseDto.fromResult);
    dto.total = result.total;
    dto.page = result.page;
    dto.size = result.size;
    return dto;
  }
}
