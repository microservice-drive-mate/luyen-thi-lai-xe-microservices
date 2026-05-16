import { DomainException } from '@repo/common';

export class InvalidMimeTypeException extends DomainException {
  readonly code = 'INVALID_MIME_TYPE';

  constructor(mimeType: string) {
    super(`Định dạng file "${mimeType}" không được phép`);
  }
}
