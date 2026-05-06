import { ValueObject, DomainException } from '@repo/common';

export class InvalidPhoneNumberException extends DomainException {
  readonly code = 'INVALID_PHONE_NUMBER';
}

export class PhoneNumber extends ValueObject<{ value: string }> {
  private static readonly VN_PHONE_REGEX = /^(0|\+84)[3-9]\d{8}$/;

  private constructor(props: { value: string }) {
    super(props);
  }

  static create(value: string): PhoneNumber {
    const normalized = value.trim().replace(/\s/g, '');
    if (!PhoneNumber.VN_PHONE_REGEX.test(normalized)) {
      throw new InvalidPhoneNumberException(
        `"${value}" is not a valid Vietnamese phone number`,
      );
    }
    return new PhoneNumber({ value: normalized });
  }

  get value(): string {
    return this.props.value;
  }
}
