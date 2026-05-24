import { ValueObject } from '@repo/common';
import { InvalidEmailException } from '../exceptions/invalid-email.exception';

export class Email extends ValueObject<{ value: string }> {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private constructor(props: { value: string }) {
    super(props);
  }

  static create(value: string): Email {
    const normalized = value.trim().toLowerCase();
    if (!Email.EMAIL_REGEX.test(normalized)) {
      throw new InvalidEmailException(value);
    }
    return new Email({ value: normalized });
  }

  get value(): string {
    return this.props.value;
  }
}
