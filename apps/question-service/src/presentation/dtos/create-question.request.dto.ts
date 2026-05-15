import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  LicenseCategory,
  QuestionDifficulty,
  QuestionType,
} from '../../domain/aggregates/question/question.types';

export class QuestionOptionRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  content: string;

  @ApiProperty()
  @IsBoolean()
  isCorrect: boolean;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  displayOrder: number;
}

export class CreateQuestionRequestDto {
  @ApiProperty({ example: 'Khi gặp đèn đỏ, người lái xe phải làm gì?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;

  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  type: QuestionType;

  @ApiProperty({ enum: LicenseCategory, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(LicenseCategory, { each: true })
  licenseCategories: LicenseCategory[];

  @ApiProperty({ enum: QuestionDifficulty })
  @IsEnum(QuestionDifficulty)
  difficulty: QuestionDifficulty;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  explanation: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Reference to media-service FileObject for question image',
  })
  @IsOptional()
  @IsUUID('4')
  mediaFileId?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isCritical?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty()
  @IsUUID('4')
  topicId: string;

  @ApiProperty({ type: [QuestionOptionRequestDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionRequestDto)
  options: QuestionOptionRequestDto[];
}
