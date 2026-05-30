import { DomainException } from '@repo/common';

export class InvalidExamTemplateException extends DomainException {
  readonly code = 'INVALID_EXAM_TEMPLATE';
}

export class ExamTemplateNotFoundException extends DomainException {
  readonly code = 'EXAM_TEMPLATE_NOT_FOUND';
  constructor(message = 'Exam template not found. (MSG83)') {
    super(message);
  }
}

export class ExamTemplateInactiveException extends DomainException {
  readonly code = 'EXAM_TEMPLATE_INACTIVE';
  constructor(message = 'Exam template is inactive.') {
    super(message);
  }
}

export class ExamTemplateAlreadyDeletedException extends DomainException {
  readonly code = 'EXAM_TEMPLATE_ALREADY_DELETED';
  constructor(message = 'Exam template not found. (MSG83)') {
    super(message);
  }
}

export class ExamTemplateVersionConflictException extends DomainException {
  readonly code = 'EXAM_TEMPLATE_VERSION_CONFLICT';
  constructor(
    message = 'This exam template was modified by another user. Please reload and try again. (MSG82)',
  ) {
    super(message);
  }
}

export class ExamTemplateInUseException extends DomainException {
  readonly code = 'EXAM_TEMPLATE_IN_USE';
  constructor(
    message = 'Exam template cannot be deleted because it is currently in use. (MSG85)',
  ) {
    super(message);
  }
}

export class InvalidExamSessionException extends DomainException {
  readonly code = 'INVALID_EXAM_SESSION';
}

export class ExamSessionNotFoundException extends DomainException {
  readonly code = 'EXAM_SESSION_NOT_FOUND';
  constructor(message = 'Exam session resource not found. (MSG42)') {
    super(message);
  }
}

export class ExamSessionQuestionNotFoundException extends DomainException {
  readonly code = 'EXAM_SESSION_QUESTION_NOT_FOUND';
  constructor(message = 'Exam session resource not found. (MSG42)') {
    super(message);
  }
}

export class ExamSessionAlreadyFinishedException extends DomainException {
  readonly code = 'EXAM_SESSION_ALREADY_FINISHED';
  constructor(message = 'Invalid exam submission request. (MSG45)') {
    super(message);
  }
}

export class ExamSessionExpiredException extends DomainException {
  readonly code = 'EXAM_SESSION_EXPIRED';
  constructor(message = 'Exam session has expired. (MSG40)') {
    super(message);
  }
}

export class ExamSessionNotFinishedException extends DomainException {
  readonly code = 'EXAM_SESSION_NOT_FINISHED';
  constructor(message = 'Exam session is not finished. (MSG49)') {
    super(message);
  }
}

export class ExamSessionUnauthorizedException extends DomainException {
  readonly code = 'EXAM_SESSION_UNAUTHORIZED';
  constructor(
    message = 'You are not authorized to manage exam session. (MSG41)',
  ) {
    super(message);
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
    super(
      `Generation resource not found: question bank only has ${actual} questions, but ${required} are required. (MSG89)`,
    );
  }
}
