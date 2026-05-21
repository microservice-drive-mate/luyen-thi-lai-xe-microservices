import { ValueObject } from '@repo/common';
import { FileTooLargeException } from '../exceptions/file-too-large.exception';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export class FileSize extends ValueObject<{ value: number }> {
  private constructor(value: number) {
    super({ value });
  }

  static create(value: number): FileSize {
    if (value <= 0 || value > MAX_FILE_SIZE_BYTES) {
      throw new FileTooLargeException(value, MAX_FILE_SIZE_BYTES);
    }
    return new FileSize(value);
  }

  static reconstitute(value: number): FileSize {
    return new FileSize(value);
  }

  get value(): number {
    return this.props.value;
  }
}
