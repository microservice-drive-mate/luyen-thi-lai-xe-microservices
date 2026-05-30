import { DomainException } from '@repo/common';

export class IdentityUserNotFoundException extends DomainException {
  readonly code = 'IDENTITY_USER_NOT_FOUND';

  constructor(_userId: string) {
    super('User account not found. (MSG12)');
  }
}
