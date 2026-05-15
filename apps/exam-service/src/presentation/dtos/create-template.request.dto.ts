import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import { LicenseCategory } from '../../domain/aggregates/exam-template/exam-template.types';

export class CreateTemplateRequestDto {
  @ApiProperty({ example: 'De thi B2 co ban' })
  @IsString()
  @IsNotEmpty()
  name: string;

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
}
