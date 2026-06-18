import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  B2_TEMPLATE_TOPIC_DISTRIBUTION_EXAMPLE,
  TopicDistributionItemRequestDto,
} from './create-template.request.dto';

export class UpdateTemplateRequestDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  version: number;

  @ApiPropertyOptional({ example: 'De thi B2 cap nhat' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    example: 'De thi mo phong theo cau truc GPLX hang B2',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalQuestions?: number;

  @ApiPropertyOptional({ example: 26 })
  @IsOptional()
  @IsInt()
  @Min(1)
  passingScore?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(180)
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  criticalQuestions?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxCriticalMistakes?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @ApiPropertyOptional({
    type: [TopicDistributionItemRequestDto],
    example: B2_TEMPLATE_TOPIC_DISTRIBUTION_EXAMPLE,
    description:
      'Strict per-topic counts. Sum of questionCount must equal totalQuestions.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TopicDistributionItemRequestDto)
  topicDistribution?: TopicDistributionItemRequestDto[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
