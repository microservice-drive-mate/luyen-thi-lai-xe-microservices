import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
} from 'class-validator';

export class AddCourseMaterialRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description:
      'Public URL của file tài liệu (lấy từ response của POST /media/files)',
    example: 'https://mediasvdev2026.blob.core.windows.net/media/docs/abc.pdf',
  })
  @IsOptional()
  @IsUrl()
  fileUrl?: string | null;

  @ApiPropertyOptional({
    description:
      'ID file từ media-service (upload file tại POST /media/files trước, rồi dùng id trả về)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  mediaFileId?: string | null;

  @ApiPropertyOptional({ example: 'PDF' })
  @IsOptional()
  @IsString()
  type?: string | null;
}
