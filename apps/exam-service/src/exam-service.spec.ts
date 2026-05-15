import { EventPublisher } from './application/ports/event-publisher.port';
import { QuestionPoolClient } from './application/ports/question-pool.client';
import { UserProfileClient } from './application/ports/user-profile.client';
import { StartSessionCommand } from './application/use-cases/start-session/start-session.command';
import { StartSessionUseCase } from './application/use-cases/start-session/start-session.use-case';
import { SubmitSessionCommand } from './application/use-cases/submit-session/submit-session.command';
import { SubmitSessionUseCase } from './application/use-cases/submit-session/submit-session.use-case';
import { ExamSession } from './domain/aggregates/exam-session/exam-session.aggregate';
import { ExamTemplate } from './domain/aggregates/exam-template/exam-template.aggregate';
import { LicenseCategory } from './domain/aggregates/exam-template/exam-template.types';
import {
  InsufficientQuestionPoolException,
  StudentLicenseMismatchException,
} from './domain/exceptions/exam.exceptions';
import { ExamSessionRepository } from './domain/repositories/exam-session.repository';
import { ExamTemplateRepository } from './domain/repositories/exam-template.repository';

function createTemplate() {
  return ExamTemplate.create({
    name: 'De thi B2',
    licenseCategory: LicenseCategory.B2,
    totalQuestions: 2,
    passingScore: 2,
    durationMinutes: 20,
    createdById: 'admin-id',
  });
}

function createSession() {
  return ExamSession.create({
    studentId: 'student-id',
    templateId: 'template-id',
    licenseCategory: LicenseCategory.B2,
    passingScore: 2,
    durationMinutes: 20,
    questions: [
      {
        questionId: 'q1',
        questionContent: 'Question 1',
        correctOptionId: 'q1-o1',
        isCritical: false,
        displayOrder: 1,
        optionsSnapshot: [
          { id: 'q1-o1', content: 'A', displayOrder: 1 },
          { id: 'q1-o2', content: 'B', displayOrder: 2 },
        ],
      },
      {
        questionId: 'q2',
        questionContent: 'Question 2',
        correctOptionId: 'q2-o1',
        isCritical: true,
        displayOrder: 2,
        optionsSnapshot: [
          { id: 'q2-o1', content: 'A', displayOrder: 1 },
          { id: 'q2-o2', content: 'B', displayOrder: 2 },
        ],
      },
    ],
  });
}

describe('ExamSession domain', () => {
  it('grades a passed session', () => {
    const session = createSession();
    session.saveAnswer('q1', 'q1-o1');
    session.saveAnswer('q2', 'q2-o1');

    session.submit();

    expect(session.score).toBe(2);
    expect(session.isPassed).toBe(true);
    expect(session.failedByCritical).toBe(false);
  });

  it('fails when a critical question is wrong', () => {
    const session = createSession();
    session.saveAnswer('q1', 'q1-o1');
    session.saveAnswer('q2', 'q2-o2');

    session.submit();

    expect(session.score).toBe(1);
    expect(session.isPassed).toBe(false);
    expect(session.failedByCritical).toBe(true);
  });

  it('rejects double submit', () => {
    const session = createSession();
    session.submit();

    expect(() => session.submit()).toThrow('already finished');
  });
});

describe('Exam use cases', () => {
  let templateRepository: jest.Mocked<ExamTemplateRepository>;
  let sessionRepository: jest.Mocked<ExamSessionRepository>;
  let questionPoolClient: jest.Mocked<QuestionPoolClient>;
  let userProfileClient: jest.Mocked<UserProfileClient>;
  let eventPublisher: jest.Mocked<EventPublisher>;

  beforeEach(() => {
    templateRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      hasSessions: jest.fn(),
      save: jest.fn(),
    };
    sessionRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
    };
    questionPoolClient = { getPool: jest.fn() };
    userProfileClient = { getCurrentStudentProfile: jest.fn() };
    eventPublisher = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    };
  });

  it('starts a session from template and question pool', async () => {
    templateRepository.findById.mockResolvedValue(createTemplate());
    userProfileClient.getCurrentStudentProfile.mockResolvedValue({
      id: 'student-id',
      role: 'STUDENT',
      isActive: true,
      studentDetail: { licenseTier: LicenseCategory.B2 },
    });
    questionPoolClient.getPool.mockResolvedValue([
      {
        id: 'q1',
        content: 'Question 1',
        isCritical: false,
        options: [
          { id: 'q1-o1', content: 'A', isCorrect: true, displayOrder: 1 },
          { id: 'q1-o2', content: 'B', isCorrect: false, displayOrder: 2 },
        ],
      },
      {
        id: 'q2',
        content: 'Question 2',
        isCritical: true,
        options: [
          { id: 'q2-o1', content: 'A', isCorrect: true, displayOrder: 1 },
          { id: 'q2-o2', content: 'B', isCorrect: false, displayOrder: 2 },
        ],
      },
    ]);

    const useCase = new StartSessionUseCase(
      templateRepository,
      sessionRepository,
      questionPoolClient,
      userProfileClient,
    );
    const result = await useCase.execute(
      new StartSessionCommand('template-id', 'student-id', 'token'),
    );

    expect(result.questions).toHaveLength(2);
    expect(sessionRepository.save).toHaveBeenCalledTimes(1);
  });

  it('rejects license tier mismatch', async () => {
    templateRepository.findById.mockResolvedValue(createTemplate());
    userProfileClient.getCurrentStudentProfile.mockResolvedValue({
      id: 'student-id',
      role: 'STUDENT',
      isActive: true,
      studentDetail: { licenseTier: LicenseCategory.A1 },
    });

    const useCase = new StartSessionUseCase(
      templateRepository,
      sessionRepository,
      questionPoolClient,
      userProfileClient,
    );

    await expect(
      useCase.execute(
        new StartSessionCommand('template-id', 'student-id', 'token'),
      ),
    ).rejects.toBeInstanceOf(StudentLicenseMismatchException);
  });

  it('rejects insufficient question pool', async () => {
    templateRepository.findById.mockResolvedValue(createTemplate());
    userProfileClient.getCurrentStudentProfile.mockResolvedValue({
      id: 'student-id',
      role: 'STUDENT',
      isActive: true,
      studentDetail: { licenseTier: LicenseCategory.B2 },
    });
    questionPoolClient.getPool.mockResolvedValue([]);

    const useCase = new StartSessionUseCase(
      templateRepository,
      sessionRepository,
      questionPoolClient,
      userProfileClient,
    );

    await expect(
      useCase.execute(
        new StartSessionCommand('template-id', 'student-id', 'token'),
      ),
    ).rejects.toBeInstanceOf(InsufficientQuestionPoolException);
  });

  it('publishes events after submit save', async () => {
    const session = createSession();
    session.saveAnswer('q1', 'q1-o1');
    session.saveAnswer('q2', 'q2-o1');
    sessionRepository.findById.mockResolvedValue(session);

    const useCase = new SubmitSessionUseCase(sessionRepository, eventPublisher);
    const result = await useCase.execute(
      new SubmitSessionCommand(session.id, 'student-id'),
    );

    expect(result.isPassed).toBe(true);
    expect(sessionRepository.save).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publishAll).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ eventName: 'exam.session.completed' }),
        expect.objectContaining({ eventName: 'exam.session.passed' }),
      ]),
    );
  });
});
