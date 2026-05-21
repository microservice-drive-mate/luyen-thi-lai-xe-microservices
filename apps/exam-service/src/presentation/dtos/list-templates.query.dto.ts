import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { LicenseCategory } from '../../domain/aggregates/exam-template/exam-template.types';

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined) return undefined;
  return value === true || value === 'true';
};

export class ListTemplatesQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number;

  @ApiPropertyOptional({ enum: LicenseCategory })
  @IsOptional()
  @IsEnum(LicenseCategory)
  licenseCategory?: LicenseCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeDeleted?: boolean;
}
