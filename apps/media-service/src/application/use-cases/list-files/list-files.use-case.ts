import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { FileObjectRepository } from '../../../domain/repositories/file-object.repository';
import { FileObjectResult } from '../shared/file-object.result';
import { ListFilesQuery } from './list-files.query';

export class ListFilesResult {
  constructor(
    readonly items: FileObjectResult[],
    readonly total: number,
    readonly page: number,
    readonly size: number,
  ) {}
}

@Injectable()
export class ListFilesUseCase
  implements IUseCase<ListFilesQuery, ListFilesResult>
{
  constructor(private readonly fileObjectRepository: FileObjectRepository) {}

  async execute(query: ListFilesQuery): Promise<ListFilesResult> {
    const { items, total } = await this.fileObjectRepository.list({
      page: query.page,
      size: query.size,
      uploadedById: query.uploadedById,
      mimeType: query.mimeType,
    });

    return new ListFilesResult(
      items.map(
        (f) =>
          new FileObjectResult(
            f.id,
            f.storageKey,
            f.originalName,
            f.mimeType,
            f.fileSize,
            f.bucketName,
            f.uploadedById,
            f.isPublic,
            f.status,
            f.createdAt,
          ),
      ),
      total,
      query.page,
      query.size,
    );
  }
}
