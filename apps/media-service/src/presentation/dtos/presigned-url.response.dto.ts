import { ApiProperty } from '@nestjs/swagger';
import { PresignedUrlResult } from '../../application/use-cases/get-presigned-url/get-presigned-url.result';

export class PresignedUrlResponseDto {
  @ApiProperty()
  url!: string;

  @ApiProperty()
  expiresAt!: Date;

  static fromResult(result: PresignedUrlResult): PresignedUrlResponseDto {
    const dto = new PresignedUrlResponseDto();
    dto.url = result.url;
    dto.expiresAt = result.expiresAt;
    return dto;
  }
}
