import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { FileNotFoundException } from '../../../domain/exceptions/file-not-found.exception';
import { FileObjectRepository } from '../../../domain/repositories/file-object.repository';
import { EventPublisher } from '../../ports/event-publisher.port';
import { StoragePort } from '../../ports/storage.port';
import { DeleteFileCommand } from './delete-file.command';

@Injectable()
export class DeleteFileUseCase implements IUseCase<DeleteFileCommand, void> {
  constructor(
    private readonly fileObjectRepository: FileObjectRepository,
    private readonly storagePort: StoragePort,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: DeleteFileCommand): Promise<void> {
    const fileObject = await this.fileObjectRepository.findById(command.fileId);
    if (!fileObject) {
      throw new FileNotFoundException(command.fileId);
    }

    fileObject.markDeleted(command.deletedById);

    // Delete from DB first — if storage delete fails, the blob becomes an orphan
    // but the metadata is gone (recoverable). The reverse leaves a dangling record.
    await this.fileObjectRepository.delete(command.fileId);
    await this.storagePort.delete(fileObject.storageKey);

    const events = fileObject.getDomainEvents();
    await this.eventPublisher.publishAll(events);
    fileObject.clearDomainEvents();
  }
}
