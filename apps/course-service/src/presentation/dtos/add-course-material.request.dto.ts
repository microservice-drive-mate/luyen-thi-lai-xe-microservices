import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddCourseMaterialRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string | null;

  @ApiPropertyOptional({ example: 'PDF' })
  @IsOptional()
  @IsString()
  type?: string | null;
}
