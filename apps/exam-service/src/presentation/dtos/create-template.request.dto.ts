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

export const B2_TEMPLATE_TOPIC_DISTRIBUTION_EXAMPLE = [
  { topicId: '9f49045f-156e-5252-8486-babb36dc74fd', questionCount: 9 },
  { topicId: '6d568ff3-458d-5764-bb15-ae3258b75a40', questionCount: 1 },
  { topicId: 'a81d3294-cc8b-579e-9567-8bbc39f96b60', questionCount: 1 },
  { topicId: '6d38e12b-adec-5c2c-b029-e01ae1fdabd2', questionCount: 1 },
  { topicId: 'd7a509c3-153f-5c03-9398-6a5626aa70d0', questionCount: 9 },
  { topicId: '0694bef4-6534-56d3-bc68-a3a0fb8f4f43', questionCount: 9 },
] as const;

export class TopicDistributionItemRequestDto {
  @ApiProperty({ example: '9f49045f-156e-5252-8486-babb36dc74fd' })
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

  @ApiProperty({
    type: [TopicDistributionItemRequestDto],
    example: B2_TEMPLATE_TOPIC_DISTRIBUTION_EXAMPLE,
    description:
      'Strict per-topic counts. Sum of questionCount must equal totalQuestions.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TopicDistributionItemRequestDto)
  topicDistribution: TopicDistributionItemRequestDto[];
}
