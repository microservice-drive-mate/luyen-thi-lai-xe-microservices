import { DomainException } from '@repo/common';

export class InvalidEmailException extends DomainException {
  readonly code = 'INVALID_EMAIL';

  constructor(email: string) {
    super(`Invalid email: ${email}`);
  }
}
