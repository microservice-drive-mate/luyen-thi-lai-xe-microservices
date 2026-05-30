import { DomainException } from '@repo/common';

export class Practice2dInvalidRequestException extends DomainException {
  readonly code = 'PRACTICE2D_INVALID_REQUEST';
}

export class Practice2dUnsupportedClientException extends DomainException {
  readonly code = 'PRACTICE2D_UNSUPPORTED_CLIENT';
}

export class Practice2dSessionNotFoundException extends DomainException {
  readonly code = 'PRACTICE2D_SESSION_NOT_FOUND';

  constructor(sessionId: string) {
    super(`Practice 2D session not found: ${sessionId}`);
  }
}

export class Practice2dSessionUnauthorizedException extends DomainException {
  readonly code = 'PRACTICE2D_SESSION_UNAUTHORIZED';

  constructor(sessionId: string) {
    super(`Student cannot access practice 2D session: ${sessionId}`);
  }
}

export class Practice2dSessionNotActiveException extends DomainException {
  readonly code = 'PRACTICE2D_SESSION_NOT_ACTIVE';

  constructor(sessionId: string) {
    super(`Practice 2D session is not active: ${sessionId}`);
  }
}
