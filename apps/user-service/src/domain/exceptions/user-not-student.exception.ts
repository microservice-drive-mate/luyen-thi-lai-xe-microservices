import { DomainException } from '@repo/common';

export class UserNotStudentException extends DomainException {
  readonly code = 'USER_NOT_STUDENT';

  constructor() {
    super('This operation is only allowed for users with STUDENT role');
  }
}
