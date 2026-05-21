import { ApiProperty } from '@nestjs/swagger';
import { InitiateUploadResult } from '../../application/use-cases/initiate-upload/initiate-upload.result';

export class InitiateUploadResponseDto {
  @ApiProperty({
    description:
      'ID của file — dùng làm mediaFileId khi gọi user-service / course-service',
  })
  mediaFileId: string;

  @ApiProperty({
    description:
      'SAS URL để client PUT file trực tiếp lên Azure Blob Storage (hết hạn sau expiresAt)',
  })
  uploadUrl: string;

  @ApiProperty({
    description:
      'URL công khai của blob sau khi upload thành công — dùng làm avatarUrl / fileUrl',
  })
  publicUrl: string;

  @ApiProperty({ description: 'Thời điểm uploadUrl hết hạn' })
  expiresAt: Date;

  static fromResult(result: InitiateUploadResult): InitiateUploadResponseDto {
    const dto = new InitiateUploadResponseDto();
    dto.mediaFileId = result.mediaFileId;
    dto.uploadUrl = result.uploadUrl;
    dto.publicUrl = result.publicUrl;
    dto.expiresAt = result.expiresAt;
    return dto;
  }
}
