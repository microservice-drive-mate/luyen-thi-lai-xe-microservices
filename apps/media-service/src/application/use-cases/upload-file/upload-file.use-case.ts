import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { FileObject } from '../../../domain/aggregates/file-object/file-object.aggregate';
import { FileObjectRepository } from '../../../domain/repositories/file-object.repository';
import { EventPublisher } from '../../ports/event-publisher.port';
import { StoragePort } from '../../ports/storage.port';
import { FileObjectResult } from '../shared/file-object.result';
import { UploadFileCommand } from './upload-file.command';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UploadFileUseCase
  implements IUseCase<UploadFileCommand, FileObjectResult>
{
  constructor(
    private readonly fileObjectRepository: FileObjectRepository,
    private readonly storagePort: StoragePort,
    private readonly eventPublisher: EventPublisher,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: UploadFileCommand): Promise<FileObjectResult> {
    const id = crypto.randomUUID();
    const ext = command.originalName.split('.').pop() ?? '';
    const storageKey = `uploads/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${id}.${ext}`;
    const bucketName =
      this.configService.get<string>('storage.containerName') ?? 'media';

    await this.storagePort.upload(storageKey, command.buffer, command.mimeType);

    const fileObject = FileObject.create({
      id,
      storageKey,
      originalName: command.originalName,
      mimeType: command.mimeType,
      fileSize: command.fileSize,
      bucketName,
      uploadedById: command.uploadedById,
      isPublic: command.isPublic,
    });

    await this.fileObjectRepository.save(fileObject);

    const events = fileObject.getDomainEvents();
    await this.eventPublisher.publishAll(events);
    fileObject.clearDomainEvents();

    return new FileObjectResult(
      fileObject.id,
      fileObject.storageKey,
      fileObject.originalName,
      fileObject.mimeType,
      fileObject.fileSize,
      fileObject.bucketName,
      fileObject.uploadedById,
      fileObject.isPublic,
      fileObject.createdAt,
    );
  }
}
