import { DomainException } from '@repo/common';

export class QuestionNotFoundException extends DomainException {
  readonly code = 'QUESTION_NOT_FOUND';

  constructor(questionId: string) {
    super(`Không tìm thấy câu hỏi: ${questionId}`);
  }
}

export class QuestionTopicNotFoundException extends DomainException {
  readonly code = 'QUESTION_TOPIC_NOT_FOUND';

  constructor(topicId: string) {
    super(`Không tìm thấy chủ đề câu hỏi: ${topicId}`);
  }
}

export class InvalidQuestionException extends DomainException {
  readonly code = 'INVALID_QUESTION';
}

export class QuestionAlreadyDeletedException extends DomainException {
  readonly code = 'QUESTION_ALREADY_DELETED';

  constructor(questionId: string) {
    super(`Câu hỏi đã bị xóa: ${questionId}`);
  }
}

export class QuestionVersionConflictException extends DomainException {
  readonly code = 'QUESTION_VERSION_CONFLICT';

  constructor(questionId: string) {
    super(`Câu hỏi ${questionId} đã bị thay đổi bởi người dùng khác`);
  }
}

export class QuestionDuplicateException extends DomainException {
  readonly code = 'QUESTION_DUPLICATE';

  constructor() {
    super('Câu hỏi với chữ ký tương tự đã tồn tại');
  }
}
