import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ListQuestionTopicsResult,
  QuestionTopicResult,
} from '../../application/use-cases/shared/question-topic.result';

export class QuestionTopicResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() description: string | null;
  @ApiPropertyOptional() parentId: string | null;
  @ApiProperty() createdAt: Date;

  static fromResult(result: QuestionTopicResult): QuestionTopicResponseDto {
    const dto = new QuestionTopicResponseDto();
    Object.assign(dto, result);
    return dto;
  }
}

export class ListQuestionTopicsResponseDto {
  @ApiProperty({ type: [QuestionTopicResponseDto] })
  items: QuestionTopicResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() size: number;

  static fromResult(
    result: ListQuestionTopicsResult,
  ): ListQuestionTopicsResponseDto {
    const dto = new ListQuestionTopicsResponseDto();
    dto.items = result.items.map(QuestionTopicResponseDto.fromResult);
    dto.total = result.total;
    dto.page = result.page;
    dto.size = result.size;
    return dto;
  }
}
