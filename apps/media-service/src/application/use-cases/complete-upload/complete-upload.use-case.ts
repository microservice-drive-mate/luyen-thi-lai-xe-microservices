import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { FileNotFoundException } from '../../../domain/exceptions/file-not-found.exception';
import { FileUploadNotCompletedException } from '../../../domain/exceptions/file-upload-not-completed.exception';
import { FileObjectRepository } from '../../../domain/repositories/file-object.repository';
import { StoragePort } from '../../ports/storage.port';
import { FileObjectResult } from '../shared/file-object.result';
import { CompleteUploadCommand } from './complete-upload.command';

@Injectable()
export class CompleteUploadUseCase
  implements IUseCase<CompleteUploadCommand, FileObjectResult>
{
  constructor(
    private readonly fileObjectRepository: FileObjectRepository,
    private readonly storagePort: StoragePort,
  ) {}

  async execute(command: CompleteUploadCommand): Promise<FileObjectResult> {
    const fileObject = await this.fileObjectRepository.findById(command.fileId);
    if (!fileObject) {
      throw new FileNotFoundException(command.fileId);
    }

    const exists = await this.storagePort.exists(fileObject.storageKey);
    if (!exists) {
      throw new FileUploadNotCompletedException(command.fileId);
    }

    fileObject.markUploaded();
    await this.fileObjectRepository.save(fileObject);

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
