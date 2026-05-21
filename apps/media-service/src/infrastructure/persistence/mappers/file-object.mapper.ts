import { FileObject } from '../../../domain/aggregates/file-object/file-object.aggregate';
import { FileStatus } from '../../../domain/aggregates/file-object/file-object.types';

export interface RawFileObjectRow {
  id: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  bucketName: string;
  uploadedById: string;
  isPublic: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export const FileObjectMapper = {
  toDomain(raw: RawFileObjectRow): FileObject {
    return FileObject.reconstitute({
      id: raw.id,
      storageKey: raw.storageKey,
      originalName: raw.originalName,
      mimeType: raw.mimeType,
      fileSize: raw.fileSize,
      bucketName: raw.bucketName,
      uploadedById: raw.uploadedById,
      isPublic: raw.isPublic,
      status: raw.status as FileStatus,
      createdAt: raw.createdAt,
    });
  },
};
