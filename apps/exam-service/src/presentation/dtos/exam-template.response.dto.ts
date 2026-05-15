import { ApiProperty } from '@nestjs/swagger';
import {
  ExamTemplateResult,
  ListExamTemplatesResult,
} from '../../application/use-cases/shared/exam-template.result';
import { LicenseCategory } from '../../domain/aggregates/exam-template/exam-template.types';

export class ExamTemplateResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: LicenseCategory }) licenseCategory: LicenseCategory;
  @ApiProperty() totalQuestions: number;
  @ApiProperty() passingScore: number;
  @ApiProperty() durationMinutes: number;
  @ApiProperty() isActive: boolean;
  @ApiProperty() isDeleted: boolean;
  @ApiProperty() version: number;
  @ApiProperty() createdById: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromResult(result: ExamTemplateResult): ExamTemplateResponseDto {
    const dto = new ExamTemplateResponseDto();
    Object.assign(dto, result);
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
