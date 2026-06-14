import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserDocumentStatus, UserDocumentType } from '@prisma/user-client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UserDocumentResult } from '../../application/use-cases/shared/user-document.result';

export class CreateUserDocumentRequestDto {
  @ApiProperty({
    enum: UserDocumentType,
    example: UserDocumentType.ID_CARD_FRONT,
  })
  @IsEnum(UserDocumentType)
  type: UserDocumentType;

  @ApiProperty({ example: 'media-file-uuid' })
  @IsString()
  mediaFileId: string;

  @ApiPropertyOptional({ example: 'CCCD mat truoc' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    enum: UserDocumentStatus,
    example: UserDocumentStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(UserDocumentStatus)
  status?: UserDocumentStatus;
}

export class UserDocumentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty({ enum: UserDocumentType }) type: UserDocumentType;
  @ApiProperty() mediaFileId: string;
  @ApiPropertyOptional({ nullable: true }) title: string | null;
  @ApiProperty({ enum: UserDocumentStatus }) status: UserDocumentStatus;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromResult(result: UserDocumentResult): UserDocumentResponseDto {
    const dto = new UserDocumentResponseDto();
    Object.assign(dto, result);
    return dto;
  }
}
