import { DomainException } from '@repo/common';

export class InvalidEmailException extends DomainException {
  readonly code = 'INVALID_EMAIL';

  constructor(_email: string) {
    super('Please enter a valid email address. (MSG04)');
  }
}
