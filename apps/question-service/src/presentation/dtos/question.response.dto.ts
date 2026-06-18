import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ListQuestionsResult,
  QuestionOptionResult,
  QuestionPoolResult,
  QuestionResult,
} from '../../application/use-cases/shared/question.result';
import {
  LicenseCategory,
  QuestionDifficulty,
  QuestionType,
} from '../../domain/aggregates/question/question.types';

export class QuestionOptionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() content: string;
  @ApiProperty() isCorrect: boolean;
  @ApiProperty() displayOrder: number;

  static fromResult(result: QuestionOptionResult): QuestionOptionResponseDto {
    const dto = new QuestionOptionResponseDto();
    Object.assign(dto, result);
    return dto;
  }
}

export class QuestionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() content: string;
  @ApiProperty({ enum: QuestionType }) type: QuestionType;
  @ApiProperty({ enum: LicenseCategory, isArray: true })
  licenseCategories: LicenseCategory[];
  @ApiProperty({ enum: QuestionDifficulty }) difficulty: QuestionDifficulty;
  @ApiProperty() explanation: string;
  @ApiPropertyOptional() imageUrl: string | null;
  @ApiPropertyOptional() mediaFileId: string | null;
  @ApiProperty() isCritical: boolean;
  @ApiProperty() isActive: boolean;
  @ApiProperty() isDeleted: boolean;
  @ApiProperty() topicId: string;
  @ApiProperty() createdById: string;
  @ApiProperty() version: number;
  @ApiPropertyOptional() deletedById: string | null;
  @ApiPropertyOptional() deletedAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ type: [QuestionOptionResponseDto] })
  options: QuestionOptionResponseDto[];

  static fromResult(result: QuestionResult): QuestionResponseDto {
    const dto = new QuestionResponseDto();
    dto.id = result.id;
    dto.content = result.content;
    dto.type = result.type;
    dto.licenseCategories = result.licenseCategories;
    dto.difficulty = result.difficulty;
    dto.explanation = result.explanation;
    dto.imageUrl = result.imageUrl;
    dto.mediaFileId = result.mediaFileId;
    dto.isCritical = result.isCritical;
    dto.isActive = result.isActive;
    dto.isDeleted = result.isDeleted;
    dto.topicId = result.topicId;
    dto.createdById = result.createdById;
    dto.version = result.version;
    dto.deletedById = result.deletedById;
    dto.deletedAt = result.deletedAt;
    dto.createdAt = result.createdAt;
    dto.updatedAt = result.updatedAt;
    dto.options = result.options.map(QuestionOptionResponseDto.fromResult);
    return dto;
  }
}

export class ListQuestionsResponseDto {
  @ApiProperty({ type: [QuestionResponseDto] })
  items: QuestionResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() size: number;

  static fromResult(result: ListQuestionsResult): ListQuestionsResponseDto {
    const dto = new ListQuestionsResponseDto();
    dto.items = result.items.map(QuestionResponseDto.fromResult);
    dto.total = result.total;
    dto.page = result.page;
    dto.size = result.size;
    return dto;
  }
}

export class QuestionPoolResponseDto {
  @ApiProperty({ type: [QuestionResponseDto] })
  items: QuestionResponseDto[];

  static fromResult(result: QuestionPoolResult): QuestionPoolResponseDto {
    const dto = new QuestionPoolResponseDto();
    dto.items = result.items.map(QuestionResponseDto.fromResult);
    return dto;
  }
}
