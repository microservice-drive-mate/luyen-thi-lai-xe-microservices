import { DomainException } from '@repo/common';

export class FileTooLargeException extends DomainException {
  readonly code = 'FILE_TOO_LARGE';

  constructor(actualBytes: number, maxBytes: number) {
    super(
      `Kích thước file ${actualBytes} bytes vượt quá kích thước tối đa cho phép là ${maxBytes} bytes`,
    );
  }
}
