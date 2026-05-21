import { Injectable, Logger } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { FileObjectRepository } from '../../../domain/repositories/file-object.repository';
import { ConfirmFileLinkedCommand } from './confirm-file-linked.command';

@Injectable()
export class ConfirmFileLinkedUseCase
  implements IUseCase<ConfirmFileLinkedCommand, void>
{
  private readonly logger = new Logger(ConfirmFileLinkedUseCase.name);

  constructor(private readonly fileObjectRepository: FileObjectRepository) {}

  async execute(command: ConfirmFileLinkedCommand): Promise<void> {
    const fileObject = await this.fileObjectRepository.findById(
      command.mediaFileId,
    );
    if (!fileObject) {
      this.logger.warn(
        `FileObject not found for confirmation: ${command.mediaFileId}`,
      );
      return;
    }
    fileObject.link();
    await this.fileObjectRepository.save(fileObject);
    this.logger.log(`FileObject ${command.mediaFileId} marked as LINKED`);
  }
}
