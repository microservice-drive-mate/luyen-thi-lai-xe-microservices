import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListFilesQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size: number = 20;

  @ApiPropertyOptional({ description: 'Lọc theo ID người dùng tải lên' })
  @IsOptional()
  @IsString()
  uploadedById?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo tiền tố định dạng file (VD: "image/")',
  })
  @IsOptional()
  @IsString()
  mimeType?: string;
}
