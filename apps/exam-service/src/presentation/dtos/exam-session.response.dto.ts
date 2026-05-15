import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ExamQuestionOptionResult,
  ExamSessionQuestionResult,
  ExamSessionResult,
  ListExamSessionsResult,
} from '../../application/use-cases/shared/exam-session.result';
import { ExamSessionStatus } from '../../domain/aggregates/exam-session/exam-session.types';
import { LicenseCategory } from '../../domain/aggregates/exam-template/exam-template.types';

export class ExamQuestionOptionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() content: string;
  @ApiProperty() displayOrder: number;

  static fromResult(
    result: ExamQuestionOptionResult,
  ): ExamQuestionOptionResponseDto {
    const dto = new ExamQuestionOptionResponseDto();
    Object.assign(dto, result);
    return dto;
  }
}

export class ExamSessionQuestionResponseDto {
  @ApiProperty() questionId: string;
  @ApiProperty() content: string;
  @ApiProperty({ type: [ExamQuestionOptionResponseDto] })
  options: ExamQuestionOptionResponseDto[];
  @ApiProperty() displayOrder: number;
  @ApiProperty() isCritical: boolean;
  @ApiProperty() isBookmarked: boolean;
  @ApiPropertyOptional({ nullable: true }) selectedOptionId: string | null;

  static fromResult(
    result: ExamSessionQuestionResult,
  ): ExamSessionQuestionResponseDto {
    const dto = new ExamSessionQuestionResponseDto();
    dto.questionId = result.questionId;
    dto.content = result.content;
    dto.options = result.options.map(ExamQuestionOptionResponseDto.fromResult);
    dto.displayOrder = result.displayOrder;
    dto.isCritical = result.isCritical;
    dto.isBookmarked = result.isBookmarked;
    dto.selectedOptionId = result.selectedOptionId;
    return dto;
  }
}

export class ExamResultQuestionResponseDto extends ExamSessionQuestionResponseDto {
  @ApiPropertyOptional({ nullable: true })
  isCorrect: boolean | null;

  static fromResult(
    result: ExamSessionQuestionResult,
  ): ExamResultQuestionResponseDto {
    const dto = new ExamResultQuestionResponseDto();
    Object.assign(dto, ExamSessionQuestionResponseDto.fromResult(result));
    dto.isCorrect = result.isCorrect ?? null;
    return dto;
  }
}

export class ExamSessionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() studentId: string;
  @ApiProperty() templateId: string;
  @ApiProperty({ enum: LicenseCategory }) licenseCategory: LicenseCategory;
  @ApiProperty({ enum: ExamSessionStatus }) status: ExamSessionStatus;
  @ApiPropertyOptional({ nullable: true }) score: number | null;
  @ApiPropertyOptional({ nullable: true }) isPassed: boolean | null;
  @ApiProperty() failedByCritical: boolean;
  @ApiProperty() startedAt: Date;
  @ApiPropertyOptional({ nullable: true }) finishedAt: Date | null;
  @ApiProperty() expiresAt: Date;
  @ApiProperty({ type: [ExamSessionQuestionResponseDto] })
  questions: ExamSessionQuestionResponseDto[];

  static fromResult(result: ExamSessionResult): ExamSessionResponseDto {
    const dto = new ExamSessionResponseDto();
    dto.id = result.id;
    dto.studentId = result.studentId;
    dto.templateId = result.templateId;
    dto.licenseCategory = result.licenseCategory;
    dto.status = result.status;
    dto.score = result.score;
    dto.isPassed = result.isPassed;
    dto.failedByCritical = result.failedByCritical;
    dto.startedAt = result.startedAt;
    dto.finishedAt = result.finishedAt;
    dto.expiresAt = result.expiresAt;
    dto.questions = result.questions.map(
      ExamSessionQuestionResponseDto.fromResult,
    );
    return dto;
  }
}

export class ExamSessionQuestionsResponseDto {
  @ApiProperty({ type: [ExamSessionQuestionResponseDto] })
  items: ExamSessionQuestionResponseDto[];

  static fromResult(
    result: ExamSessionResult,
  ): ExamSessionQuestionsResponseDto {
    const dto = new ExamSessionQuestionsResponseDto();
    dto.items = result.questions.map(ExamSessionQuestionResponseDto.fromResult);
    return dto;
  }
}

export class ExamSessionResultResponseDto extends ExamSessionResponseDto {
  @ApiProperty({ type: [ExamResultQuestionResponseDto] })
  declare questions: ExamResultQuestionResponseDto[];

  static fromResult(result: ExamSessionResult): ExamSessionResultResponseDto {
    const dto = new ExamSessionResultResponseDto();
    Object.assign(dto, ExamSessionResponseDto.fromResult(result));
    dto.questions = result.questions.map(
      ExamResultQuestionResponseDto.fromResult,
    );
    return dto;
  }
}

export class ListExamSessionsResponseDto {
  @ApiProperty({ type: [ExamSessionResponseDto] })
  items: ExamSessionResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() size: number;

  static fromResult(
    result: ListExamSessionsResult,
  ): ListExamSessionsResponseDto {
    const dto = new ListExamSessionsResponseDto();
    dto.items = result.items.map(ExamSessionResponseDto.fromResult);
    dto.total = result.total;
    dto.page = result.page;
    dto.size = result.size;
    return dto;
  }
}
