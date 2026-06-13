export enum FileStatus {
  UNLINKED = 'UNLINKED',
  UPLOADED = 'UPLOADED',
  LINKED = 'LINKED',
}

export interface CreateFileObjectProps {
  id: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  bucketName: string;
  uploadedById: string;
  isPublic?: boolean;
  status?: FileStatus;
}

export interface ReconstituteFileObjectProps {
  id: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  bucketName: string;
  uploadedById: string;
  isPublic: boolean;
  status: FileStatus;
  createdAt: Date;
}
