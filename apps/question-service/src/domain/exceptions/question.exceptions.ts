import { DomainException } from '@repo/common';

export class QuestionNotFoundException extends DomainException {
  readonly code = 'QUESTION_NOT_FOUND';

  constructor(_questionId?: string) {
    super('Question not found. (MSG72)');
  }
}

export class QuestionTopicNotFoundException extends DomainException {
  readonly code = 'QUESTION_TOPIC_NOT_FOUND';

  constructor(_topicId?: string) {
    super('Question context not found. (MSG66)');
  }
}

export class InvalidQuestionException extends DomainException {
  readonly code = 'INVALID_QUESTION';
}

export class QuestionAlreadyDeletedException extends DomainException {
  readonly code = 'QUESTION_ALREADY_DELETED';

  constructor(_questionId?: string) {
    super('Question not found. (MSG72)');
  }
}

export class QuestionVersionConflictException extends DomainException {
  readonly code = 'QUESTION_VERSION_CONFLICT';

  constructor(_questionId?: string) {
    super(
      'This question was modified by another user. Please reload and try again. (MSG70)',
    );
  }
}

export class QuestionDuplicateException extends DomainException {
  readonly code = 'QUESTION_DUPLICATE';

  constructor() {
    super('Question already exists. (MSG64)');
  }
}
