import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class AddLessonRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  order: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string | null;
}
