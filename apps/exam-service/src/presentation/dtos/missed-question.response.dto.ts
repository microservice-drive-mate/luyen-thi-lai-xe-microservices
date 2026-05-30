import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MissedQuestionItem } from '../../domain/repositories/exam-session.repository';

export class MissedQuestionOptionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() content!: string;
  @ApiProperty() displayOrder!: number;
}

export class MissedQuestionResponseDto {
  @ApiProperty() questionId!: string;
  @ApiProperty() content!: string;
  @ApiPropertyOptional({ nullable: true }) imageUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) mediaFileId!: string | null;
  @ApiProperty({ type: [MissedQuestionOptionResponseDto] })
  options!: MissedQuestionOptionResponseDto[];
  @ApiPropertyOptional({ nullable: true }) lastAnsweredAt!: Date | null;
  @ApiProperty() missedCount!: number;

  static fromItem(item: MissedQuestionItem): MissedQuestionResponseDto {
    return Object.assign(new MissedQuestionResponseDto(), item);
  }
}

export class ListMissedQuestionsResponseDto {
  @ApiProperty({ type: [MissedQuestionResponseDto] })
  items!: MissedQuestionResponseDto[];

  static fromItems(
    items: MissedQuestionItem[],
  ): ListMissedQuestionsResponseDto {
    const dto = new ListMissedQuestionsResponseDto();
    dto.items = items.map(MissedQuestionResponseDto.fromItem);
    return dto;
  }
}
