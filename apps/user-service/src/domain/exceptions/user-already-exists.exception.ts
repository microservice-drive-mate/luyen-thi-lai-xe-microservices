import { DomainException } from '@repo/common';

export class UserAlreadyExistsException extends DomainException {
  readonly code = 'USER_ALREADY_EXISTS';

  constructor(_email: string) {
    super('Email already exists. (MSG10)');
  }
}
