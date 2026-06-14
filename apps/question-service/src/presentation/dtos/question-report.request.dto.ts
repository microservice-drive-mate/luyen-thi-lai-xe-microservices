import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateQuestionReportRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class QuestionReportResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() questionId: string;
  @ApiProperty() userId: string;
  @ApiProperty() reason: string;
  @ApiProperty({ nullable: true }) message: string | null;
  @ApiProperty() status: string;
  @ApiProperty() createdAt: Date;
}
