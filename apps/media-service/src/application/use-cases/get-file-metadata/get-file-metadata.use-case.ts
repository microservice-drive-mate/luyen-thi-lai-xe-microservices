import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { FileNotFoundException } from '../../../domain/exceptions/file-not-found.exception';
import { FileObjectRepository } from '../../../domain/repositories/file-object.repository';
import { FileObjectResult } from '../shared/file-object.result';
import { GetFileMetadataQuery } from './get-file-metadata.query';

@Injectable()
export class GetFileMetadataUseCase
  implements IUseCase<GetFileMetadataQuery, FileObjectResult>
{
  constructor(private readonly fileObjectRepository: FileObjectRepository) {}

  async execute(query: GetFileMetadataQuery): Promise<FileObjectResult> {
    const fileObject = await this.fileObjectRepository.findById(query.fileId);
    if (!fileObject) {
      throw new FileNotFoundException(query.fileId);
    }

    return new FileObjectResult(
      fileObject.id,
      fileObject.storageKey,
      fileObject.originalName,
      fileObject.mimeType,
      fileObject.fileSize,
      fileObject.bucketName,
      fileObject.uploadedById,
      fileObject.isPublic,
      fileObject.status,
      fileObject.createdAt,
    );
  }
}
