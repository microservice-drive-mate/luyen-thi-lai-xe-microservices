import { DomainException } from '@repo/common';

export class UserNotStudentException extends DomainException {
  readonly code = 'USER_NOT_STUDENT';

  constructor() {
    super('Thao tác này chỉ dành cho người dùng có vai trò STUDENT');
  }
}
