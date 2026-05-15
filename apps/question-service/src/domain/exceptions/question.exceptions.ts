import { DomainException } from '@repo/common';

export class QuestionNotFoundException extends DomainException {
  readonly code = 'QUESTION_NOT_FOUND';

  constructor(questionId: string) {
    super(`Question not found: ${questionId}`);
  }
}

export class QuestionTopicNotFoundException extends DomainException {
  readonly code = 'QUESTION_TOPIC_NOT_FOUND';

  constructor(topicId: string) {
    super(`Question topic not found: ${topicId}`);
  }
}

export class InvalidQuestionException extends DomainException {
  readonly code = 'INVALID_QUESTION';
}

export class QuestionAlreadyDeletedException extends DomainException {
  readonly code = 'QUESTION_ALREADY_DELETED';

  constructor(questionId: string) {
    super(`Question is already deleted: ${questionId}`);
  }
}

export class QuestionVersionConflictException extends DomainException {
  readonly code = 'QUESTION_VERSION_CONFLICT';

  constructor(questionId: string) {
    super(`Question ${questionId} was modified by another user`);
  }
}

export class QuestionDuplicateException extends DomainException {
  readonly code = 'QUESTION_DUPLICATE';

  constructor() {
    super('Question with the same signature already exists');
  }
}
