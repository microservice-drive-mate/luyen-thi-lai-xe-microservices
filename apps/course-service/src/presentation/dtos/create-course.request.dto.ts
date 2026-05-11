import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LicenseCategory } from '../../domain/aggregates/course/course.types';

export class CourseRequirementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minAge?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prerequisites?: string | null;

  @ApiPropertyOptional({ default: 80 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  attendanceRate?: number;

  @ApiPropertyOptional({ default: 80 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPassScore?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  requiredExams?: number;
}

export class CreateCourseRequestDto {
  @ApiProperty({ example: 'Khóa học B1 – Cơ bản' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ enum: LicenseCategory })
  @IsEnum(LicenseCategory)
  licenseCategory: LicenseCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ example: '3 tháng' })
  @IsOptional()
  @IsString()
  duration?: string | null;

  @ApiPropertyOptional({ example: 5000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tuitionFee?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  instructorIds?: string[];

  @ApiPropertyOptional({ type: CourseRequirementDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CourseRequirementDto)
  requirement?: CourseRequirementDto | null;
}
