import { DomainException } from '@repo/common';

export class FileUploadFailedException extends DomainException {
  readonly code = 'FILE_UPLOAD_FAILED';

  constructor(key: string) {
    super(`File upload failed for key "${key}"`);
  }
}
