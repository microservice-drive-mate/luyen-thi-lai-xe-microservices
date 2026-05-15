import { DomainException } from '@repo/common';

export class InvalidExamTemplateException extends DomainException {
  readonly code = 'INVALID_EXAM_TEMPLATE';
}

export class ExamTemplateNotFoundException extends DomainException {
  readonly code = 'EXAM_TEMPLATE_NOT_FOUND';
  constructor(id: string) {
    super(`Exam template not found: ${id}`);
  }
}

export class ExamTemplateInactiveException extends DomainException {
  readonly code = 'EXAM_TEMPLATE_INACTIVE';
  constructor(id: string) {
    super(`Exam template is not available: ${id}`);
  }
}

export class ExamTemplateAlreadyDeletedException extends DomainException {
  readonly code = 'EXAM_TEMPLATE_ALREADY_DELETED';
  constructor(id: string) {
    super(`Exam template already deleted: ${id}`);
  }
}

export class ExamTemplateVersionConflictException extends DomainException {
  readonly code = 'EXAM_TEMPLATE_VERSION_CONFLICT';
  constructor(id: string) {
    super(`Exam template version conflict: ${id}`);
  }
}

export class ExamTemplateInUseException extends DomainException {
  readonly code = 'EXAM_TEMPLATE_IN_USE';
  constructor(id: string) {
    super(`Exam template is already used by exam sessions: ${id}`);
  }
}

export class InvalidExamSessionException extends DomainException {
  readonly code = 'INVALID_EXAM_SESSION';
}

export class ExamSessionNotFoundException extends DomainException {
  readonly code = 'EXAM_SESSION_NOT_FOUND';
  constructor(id: string) {
    super(`Exam session not found: ${id}`);
  }
}

export class ExamSessionQuestionNotFoundException extends DomainException {
  readonly code = 'EXAM_SESSION_QUESTION_NOT_FOUND';
  constructor(questionId: string) {
    super(`Exam session question not found: ${questionId}`);
  }
}

export class ExamSessionAlreadyFinishedException extends DomainException {
  readonly code = 'EXAM_SESSION_ALREADY_FINISHED';
  constructor(id: string) {
    super(`Exam session already finished: ${id}`);
  }
}

export class ExamSessionExpiredException extends DomainException {
  readonly code = 'EXAM_SESSION_EXPIRED';
  constructor(id: string) {
    super(`Exam session expired: ${id}`);
  }
}

export class ExamSessionNotFinishedException extends DomainException {
  readonly code = 'EXAM_SESSION_NOT_FINISHED';
  constructor(id: string) {
    super(`Exam session is not finished: ${id}`);
  }
}

export class ExamSessionUnauthorizedException extends DomainException {
  readonly code = 'EXAM_SESSION_UNAUTHORIZED';
  constructor(id: string) {
    super(`Not allowed to access exam session: ${id}`);
  }
}

export class StudentProfileInvalidException extends DomainException {
  readonly code = 'STUDENT_PROFILE_INVALID';
}

export class StudentLicenseMismatchException extends DomainException {
  readonly code = 'STUDENT_LICENSE_MISMATCH';
}

export class InsufficientQuestionPoolException extends DomainException {
  readonly code = 'INSUFFICIENT_QUESTION_POOL';
  constructor(required: number, actual: number) {
    super(`Question pool has ${actual} questions, required ${required}`);
  }
}
