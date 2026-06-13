import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateCourseScheduleRequestDto {
  @ApiProperty()
  @IsUUID('4')
  instructorId!: string;

  @ApiProperty({ example: 2, description: '1=Monday, 7=Sunday' })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @ApiProperty({ example: '07:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime!: string;

  @ApiProperty({ example: '09:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime!: string;

  @ApiPropertyOptional({ example: 'Phòng 101' })
  @IsOptional()
  @IsString()
  room?: string | null;

  @ApiProperty({ example: '2026-06-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveFrom!: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveTo?: string | null;
}

export class UpdateCourseScheduleRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  instructorId?: string;

  @ApiPropertyOptional({ example: 2, description: '1=Monday, 7=Sunday' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;

  @ApiPropertyOptional({ example: '07:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime?: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime?: string;

  @ApiPropertyOptional({ example: 'Phòng 101' })
  @IsOptional()
  @IsString()
  room?: string | null;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveFrom?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveTo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
