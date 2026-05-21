import { ValueObject } from '@repo/common';
import { InvalidMimeTypeException } from '../exceptions/invalid-mime-type.exception';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
];

export class MimeType extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(value: string): MimeType {
    if (!ALLOWED_MIME_TYPES.includes(value)) {
      throw new InvalidMimeTypeException(value);
    }
    return new MimeType(value);
  }

  static reconstitute(value: string): MimeType {
    return new MimeType(value);
  }

  get value(): string {
    return this.props.value;
  }

  static get allowedTypes(): string[] {
    return [...ALLOWED_MIME_TYPES];
  }
}
