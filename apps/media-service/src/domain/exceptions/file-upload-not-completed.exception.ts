import { DomainException } from '@repo/common';

export class FileUploadNotCompletedException extends DomainException {
  readonly code = 'FILE_UPLOAD_NOT_COMPLETED';

  constructor(id: string) {
    super(`Upload for file ${id} has not completed`);
  }
}
