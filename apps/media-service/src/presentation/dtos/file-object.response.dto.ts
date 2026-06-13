import { ApiProperty } from '@nestjs/swagger';
import { FileObjectResult } from '../../application/use-cases/shared/file-object.result';
import { ListFilesResult } from '../../application/use-cases/list-files/list-files.use-case';

export class FileObjectResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  storageKey!: string;

  @ApiProperty()
  originalName!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  fileSize!: number;

  @ApiProperty()
  bucketName!: string;

  @ApiProperty()
  uploadedById!: string;

  @ApiProperty()
  isPublic!: boolean;

  @ApiProperty({ enum: ['UNLINKED', 'UPLOADED', 'LINKED'] })
  status!: string;

  @ApiProperty()
  createdAt!: Date;

  static fromResult(result: FileObjectResult): FileObjectResponseDto {
    const dto = new FileObjectResponseDto();
    dto.id = result.id;
    dto.storageKey = result.storageKey;
    dto.originalName = result.originalName;
    dto.mimeType = result.mimeType;
    dto.fileSize = result.fileSize;
    dto.bucketName = result.bucketName;
    dto.uploadedById = result.uploadedById;
    dto.isPublic = result.isPublic;
    dto.status = result.status;
    dto.createdAt = result.createdAt;
    return dto;
  }
}

export class PaginatedFileObjectsResponseDto {
  @ApiProperty({ type: () => [FileObjectResponseDto] })
  items!: FileObjectResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  size!: number;

  static fromResult(result: ListFilesResult): PaginatedFileObjectsResponseDto {
    const dto = new PaginatedFileObjectsResponseDto();
    dto.items = result.items.map(FileObjectResponseDto.fromResult);
    dto.total = result.total;
    dto.page = result.page;
    dto.size = result.size;
    return dto;
  }
}
