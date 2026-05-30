import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListMissedQuestionsQueryDto {
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({
    default: 20,
    description: 'SRS UC32 alias for limit.',
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  size?: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(365)
  periodDays?: number;

  @ApiPropertyOptional({
    default: 30,
    description: 'SRS UC32 alias for periodDays.',
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(365)
  period?: number;

  @ApiPropertyOptional({ enum: ['frequent', 'recent'], default: 'frequent' })
  @IsOptional()
  @IsIn(['frequent', 'recent'])
  mode?: 'frequent' | 'recent' = 'frequent';
}
