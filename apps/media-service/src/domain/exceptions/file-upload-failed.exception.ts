import { DomainException } from '@repo/common';

export class FileUploadFailedException extends DomainException {
  readonly code = 'FILE_UPLOAD_FAILED';

  constructor(key: string) {
    super(`Tải lên file với key "${key}" thất bại`);
  }
}
