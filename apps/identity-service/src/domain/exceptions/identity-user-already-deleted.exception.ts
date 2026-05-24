import { DomainException } from '@repo/common';

export class IdentityUserAlreadyDeletedException extends DomainException {
  readonly code = 'IDENTITY_USER_ALREADY_DELETED';

  constructor(userId: string) {
    super(`Identity user is already deleted: ${userId}`);
  }
}
