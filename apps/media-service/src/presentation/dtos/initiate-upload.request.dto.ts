import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class InitiateUploadRequestDto {
  @ApiProperty({
    description: 'Tên file gốc, bao gồm phần mở rộng',
    example: 'avatar.jpg',
  })
  @IsString()
  @IsNotEmpty()
  originalName: string;

  @ApiProperty({ description: 'MIME type của file', example: 'image/jpeg' })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({
    description: 'Kích thước file tính bằng bytes',
    example: 204800,
  })
  @IsInt()
  @Min(1)
  fileSize: number;
}
