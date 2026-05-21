import { FileObject } from '../aggregates/file-object/file-object.aggregate';

export interface ListFilesFilter {
  uploadedById?: string;
  mimeType?: string;
  page: number;
  size: number;
}

export interface ListFilesPage {
  items: FileObject[];
  total: number;
}

export abstract class FileObjectRepository {
  abstract findById(id: string): Promise<FileObject | null>;
  abstract save(fileObject: FileObject): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract list(filter: ListFilesFilter): Promise<ListFilesPage>;
}
