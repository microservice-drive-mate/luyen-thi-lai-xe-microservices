import { DomainException } from '@repo/common';

export class UserProfileNotFoundException extends DomainException {
  readonly code = 'USER_PROFILE_NOT_FOUND';

  constructor(_id: string) {
    super('User account not found. (MSG12)');
  }
}
