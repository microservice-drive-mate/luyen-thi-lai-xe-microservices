import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

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

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
