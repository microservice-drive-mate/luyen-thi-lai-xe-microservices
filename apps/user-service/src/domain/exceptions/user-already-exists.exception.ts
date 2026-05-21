import { DomainException } from '@repo/common';

export class UserAlreadyExistsException extends DomainException {
  readonly code = 'USER_ALREADY_EXISTS';

  constructor(email: string) {
    super(`Người dùng với email "${email}" đã tồn tại`);
  }
}
