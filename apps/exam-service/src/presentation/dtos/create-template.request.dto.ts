import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { LicenseCategory } from '../../domain/aggregates/exam-template/exam-template.types';

export class TopicDistributionItemRequestDto {
  @ApiProperty({ example: '10000000-0000-0000-0000-000000000101' })
  @IsString()
  @IsNotEmpty()
  topicId: string;

  @ApiProperty({ example: 9 })
  @IsInt()
  @Min(1)
  questionCount: number;
}

export class CreateTemplateRequestDto {
  @ApiProperty({ example: 'De thi B2 co ban' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'De thi mo phong theo cau truc GPLX hang B2',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ enum: LicenseCategory, example: LicenseCategory.B2 })
  @IsEnum(LicenseCategory)
  licenseCategory: LicenseCategory;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(1)
  totalQuestions: number;

  @ApiProperty({ example: 26 })
  @IsInt()
  @Min(1)
  passingScore: number;

  @ApiProperty({ example: 20 })
  @IsInt()
  @Min(1)
  @Max(180)
  durationMinutes: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  criticalQuestions: number;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  maxCriticalMistakes: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  shuffleQuestions: boolean;

  @ApiProperty({ type: [TopicDistributionItemRequestDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TopicDistributionItemRequestDto)
  topicDistribution: TopicDistributionItemRequestDto[];
}
