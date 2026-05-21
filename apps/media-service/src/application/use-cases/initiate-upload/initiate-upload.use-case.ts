import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IUseCase } from '@repo/common';
import { FileObject } from '../../../domain/aggregates/file-object/file-object.aggregate';
import { FileStatus } from '../../../domain/aggregates/file-object/file-object.types';
import { FileObjectRepository } from '../../../domain/repositories/file-object.repository';
import { StoragePort } from '../../ports/storage.port';
import { InitiateUploadCommand } from './initiate-upload.command';
import { InitiateUploadResult } from './initiate-upload.result';

@Injectable()
export class InitiateUploadUseCase
  implements IUseCase<InitiateUploadCommand, InitiateUploadResult>
{
  constructor(
    private readonly fileObjectRepository: FileObjectRepository,
    private readonly storagePort: StoragePort,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: InitiateUploadCommand): Promise<InitiateUploadResult> {
    const id = crypto.randomUUID();
    const ext = command.originalName.split('.').pop() ?? '';
    const now = new Date();
    const storageKey = `uploads/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${id}.${ext}`;
    const bucketName =
      this.configService.get<string>('storage.containerName') ?? 'media';
    const expiresIn =
      this.configService.get<number>('storage.presignedUrlExpiry') ?? 3600;

    const { uploadUrl, publicUrl } =
      await this.storagePort.generateUploadSasUrl(
        storageKey,
        command.mimeType,
        expiresIn,
      );

    const fileObject = FileObject.create({
      id,
      storageKey,
      originalName: command.originalName,
      mimeType: command.mimeType,
      fileSize: command.fileSize,
      bucketName,
      uploadedById: command.uploadedById,
      status: FileStatus.UNLINKED,
    });

    await this.fileObjectRepository.save(fileObject);
    fileObject.clearDomainEvents();

    return new InitiateUploadResult(
      id,
      uploadUrl,
      publicUrl,
      new Date(Date.now() + expiresIn * 1000),
    );
  }
}
