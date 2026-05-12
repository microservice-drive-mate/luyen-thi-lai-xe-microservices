import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
} from 'class-validator';
import { Gender } from '../../domain/aggregates/user-profile/user-profile.types';

export class UpdateUserRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^(0|\+84)[3-9]\d{8}$/, {
    message: 'Invalid Vietnamese phone number',
  })
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dateOfBirth?: Date;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description:
      'Public URL của avatar (lấy từ response của POST /media/files)',
    example:
      'https://mediasvdev2026.blob.core.windows.net/media/avatars/abc.jpg',
  })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiPropertyOptional({
    description:
      'ID file từ media-service (upload file tại POST /media/files trước, rồi dùng id trả về)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  mediaFileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
