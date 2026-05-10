import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { CourseRequirementDto } from './create-course.request.dto';

export class UpdateCourseRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  thumbnailUrl?: string | null;

  @ApiPropertyOptional({ example: '4 tháng' })
  @IsOptional()
  @IsString()
  duration?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  tuitionFee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number | null;

  @ApiPropertyOptional({ type: CourseRequirementDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CourseRequirementDto)
  requirement?: CourseRequirementDto | null;
}
