import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/media-client';
import { FileObject } from '../../../domain/aggregates/file-object/file-object.aggregate';
import {
  FileObjectRepository,
  ListFilesFilter,
  ListFilesPage,
} from '../../../domain/repositories/file-object.repository';
import { FileObjectMapper } from '../mappers/file-object.mapper';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaFileObjectRepository extends FileObjectRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<FileObject | null> {
    const raw = await this.prisma.fileObject.findUnique({ where: { id } });
    return raw ? FileObjectMapper.toDomain(raw) : null;
  }

  async save(fileObject: FileObject): Promise<void> {
    await this.prisma.fileObject.upsert({
      where: { id: fileObject.id },
      create: {
        id: fileObject.id,
        storageKey: fileObject.storageKey,
        originalName: fileObject.originalName,
        mimeType: fileObject.mimeType,
        fileSize: fileObject.fileSize,
        bucketName: fileObject.bucketName,
        uploadedById: fileObject.uploadedById,
        isPublic: fileObject.isPublic,
        status: fileObject.status,
        createdAt: fileObject.createdAt,
      },
      update: {
        isPublic: fileObject.isPublic,
        status: fileObject.status,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.fileObject.delete({ where: { id } });
  }

  async list(filter: ListFilesFilter): Promise<ListFilesPage> {
    const where: Prisma.FileObjectWhereInput = {};

    if (filter.uploadedById) {
      where.uploadedById = filter.uploadedById;
    }
    if (filter.mimeType) {
      where.mimeType = { startsWith: filter.mimeType };
    }

    const skip = (filter.page - 1) * filter.size;

    const [rawItems, total] = await this.prisma.$transaction([
      this.prisma.fileObject.findMany({
        where,
        skip,
        take: filter.size,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.fileObject.count({ where }),
    ]);

    return {
      items: rawItems.map(FileObjectMapper.toDomain),
      total,
    };
  }
}
