import { describe, expect, it } from '@jest/globals';
import { Question } from './domain/aggregates/question/question.aggregate';
import {
  LicenseCategory,
  QuestionDifficulty,
  QuestionType,
} from './domain/aggregates/question/question.types';
import {
  InvalidQuestionException,
  QuestionAlreadyDeletedException,
  QuestionVersionConflictException,
} from './domain/exceptions/question.exceptions';

const validQuestionProps = {
  content: 'Khi gap den do, nguoi lai xe phai lam gi?',
  type: QuestionType.THEORY,
  licenseCategories: [LicenseCategory.B2],
  difficulty: QuestionDifficulty.EASY,
  explanation: 'Den do yeu cau dung lai truoc vach dung.',
  topicId: '550e8400-e29b-41d4-a716-446655440000',
  createdById: 'creator-001',
  options: [
    { content: 'Dung lai', isCorrect: true, displayOrder: 1 },
    { content: 'Di tiep neu vang nguoi', isCorrect: false, displayOrder: 2 },
  ],
};

describe('Question aggregate', () => {
  it('creates a valid question with version 1 and a created event', () => {
    const question = Question.create(validQuestionProps);

    expect(question.version).toBe(1);
    expect(question.options).toHaveLength(2);
    expect(question.getDomainEvents()).toHaveLength(1);
    expect(question.getDomainEvents()[0].eventName).toBe('question.created');
  });

  it('rejects a question without exactly one correct option', () => {
    expect(() =>
      Question.create({
        ...validQuestionProps,
        options: [
          { content: 'A', isCorrect: true, displayOrder: 1 },
          { content: 'B', isCorrect: true, displayOrder: 2 },
        ],
      }),
    ).toThrow(InvalidQuestionException);
  });

  it('rejects empty license categories', () => {
    expect(() =>
      Question.create({
        ...validQuestionProps,
        licenseCategories: [],
      }),
    ).toThrow(InvalidQuestionException);
  });

  it('increments version on update and detects stale updates', () => {
    const question = Question.create(validQuestionProps);
    question.clearDomainEvents();

    question.update({
      expectedVersion: 1,
      content: 'Noi dung moi',
    });

    expect(question.version).toBe(2);
    expect(question.content).toBe('Noi dung moi');
    expect(() =>
      question.update({
        expectedVersion: 1,
        content: 'Noi dung cu',
      }),
    ).toThrow(QuestionVersionConflictException);
  });

  it('soft deletes and blocks later mutation', () => {
    const question = Question.create(validQuestionProps);
    question.clearDomainEvents();

    question.softDelete('admin-001', 1);

    expect(question.isDeleted).toBe(true);
    expect(question.isActive).toBe(false);
    expect(question.getDomainEvents()[0].eventName).toBe(
      'question.deactivated',
    );
    expect(() =>
      question.update({
        expectedVersion: 2,
        content: 'Khong hop le',
      }),
    ).toThrow(QuestionAlreadyDeletedException);
  });
});
