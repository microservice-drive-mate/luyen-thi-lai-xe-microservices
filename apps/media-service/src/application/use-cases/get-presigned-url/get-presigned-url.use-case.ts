import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { FileNotFoundException } from '../../../domain/exceptions/file-not-found.exception';
import { FileObjectRepository } from '../../../domain/repositories/file-object.repository';
import { StoragePort } from '../../ports/storage.port';
import { GetPresignedUrlQuery } from './get-presigned-url.query';
import { PresignedUrlResult } from './get-presigned-url.result';

@Injectable()
export class GetPresignedUrlUseCase
  implements IUseCase<GetPresignedUrlQuery, PresignedUrlResult>
{
  constructor(
    private readonly fileObjectRepository: FileObjectRepository,
    private readonly storagePort: StoragePort,
  ) {}

  async execute(query: GetPresignedUrlQuery): Promise<PresignedUrlResult> {
    const fileObject = await this.fileObjectRepository.findById(query.fileId);
    if (!fileObject) {
      throw new FileNotFoundException(query.fileId);
    }

    const url = await this.storagePort.getPresignedUrl(
      fileObject.storageKey,
      query.expiresIn,
    );

    const expiresAt = new Date(Date.now() + query.expiresIn * 1000);

    return new PresignedUrlResult(url, expiresAt);
  }
}
