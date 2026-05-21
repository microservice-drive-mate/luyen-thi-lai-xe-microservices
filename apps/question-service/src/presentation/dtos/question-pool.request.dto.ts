import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import {
  LicenseCategory,
  QuestionDifficulty,
  QuestionType,
} from '../../domain/aggregates/question/question.types';

export class QuestionPoolRequestDto {
  @ApiProperty({ enum: LicenseCategory })
  @IsEnum(LicenseCategory)
  licenseCategory: LicenseCategory;

  @ApiProperty({ example: 25 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  size: number;

  @ApiPropertyOptional({ enum: QuestionType })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiPropertyOptional({ enum: QuestionDifficulty })
  @IsOptional()
  @IsEnum(QuestionDifficulty)
  difficulty?: QuestionDifficulty;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCritical?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  excludeQuestionIds?: string[];
}
