import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ListQuestionsResult,
  QuestionOptionResult,
  QuestionResult,
} from '../../application/use-cases/shared/question.result';
import {
  LicenseCategory,
  QuestionDifficulty,
  QuestionType,
} from '../../domain/aggregates/question/question.types';

export class PublicQuestionOptionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() content: string;
  @ApiProperty() displayOrder: number;

  static fromResult(
    result: QuestionOptionResult,
  ): PublicQuestionOptionResponseDto {
    const dto = new PublicQuestionOptionResponseDto();
    dto.id = result.id;
    dto.content = result.content;
    dto.displayOrder = result.displayOrder;
    return dto;
  }
}

export class PublicPracticeQuestionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() content: string;
  @ApiProperty({ enum: QuestionType }) type: QuestionType;
  @ApiProperty({ enum: LicenseCategory, isArray: true })
  licenseCategories: LicenseCategory[];
  @ApiProperty({ enum: QuestionDifficulty }) difficulty: QuestionDifficulty;
  @ApiPropertyOptional() imageUrl: string | null;
  @ApiPropertyOptional() mediaFileId: string | null;
  @ApiProperty() topicId: string;
  @ApiProperty() correctOptionId: string;
  @ApiProperty({ type: [PublicQuestionOptionResponseDto] })
  options: PublicQuestionOptionResponseDto[];

  static fromResult(result: QuestionResult): PublicPracticeQuestionResponseDto {
    const dto = new PublicPracticeQuestionResponseDto();
    dto.id = result.id;
    dto.content = result.content;
    dto.type = result.type;
    dto.licenseCategories = result.licenseCategories;
    dto.difficulty = result.difficulty;
    dto.imageUrl = result.imageUrl;
    dto.mediaFileId = result.mediaFileId;
    dto.topicId = result.topicId;
    dto.correctOptionId =
      result.options.find((option) => option.isCorrect)?.id ?? '';
    dto.options = result.options.map(
      PublicQuestionOptionResponseDto.fromResult,
    );
    return dto;
  }
}

export class PublicPracticeQuestionsResponseDto {
  @ApiProperty({ type: [PublicPracticeQuestionResponseDto] })
  items: PublicPracticeQuestionResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() size: number;

  static fromResult(
    result: ListQuestionsResult,
  ): PublicPracticeQuestionsResponseDto {
    const dto = new PublicPracticeQuestionsResponseDto();
    dto.items = result.items.map(PublicPracticeQuestionResponseDto.fromResult);
    dto.total = result.total;
    dto.page = result.page;
    dto.size = result.size;
    return dto;
  }
}
