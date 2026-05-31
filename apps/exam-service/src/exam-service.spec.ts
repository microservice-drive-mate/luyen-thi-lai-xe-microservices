import { EventPublisher } from './application/ports/event-publisher.port';
import { QuestionPoolClient } from './application/ports/question-pool.client';
import { UserProfileClient } from './application/ports/user-profile.client';
import { ListAvailableExamsQuery } from './application/use-cases/list-available-exams/list-available-exams.query';
import { ListAvailableExamsUseCase } from './application/use-cases/list-available-exams/list-available-exams.use-case';
import { GetSessionResultQuery } from './application/use-cases/get-session-result/get-session-result.query';
import { GetSessionResultUseCase } from './application/use-cases/get-session-result/get-session-result.use-case';
import { StartSessionCommand } from './application/use-cases/start-session/start-session.command';
import { StartSessionUseCase } from './application/use-cases/start-session/start-session.use-case';
import { SubmitSessionCommand } from './application/use-cases/submit-session/submit-session.command';
import { SubmitSessionUseCase } from './application/use-cases/submit-session/submit-session.use-case';
import { ExamSession } from './domain/aggregates/exam-session/exam-session.aggregate';
import { ExamSessionStatus } from './domain/aggregates/exam-session/exam-session.types';
import { ExamTemplate } from './domain/aggregates/exam-template/exam-template.aggregate';
import { LicenseCategory } from './domain/aggregates/exam-template/exam-template.types';
import {
  ExamSessionAlreadyFinishedException,
  InvalidExamTemplateException,
  InsufficientQuestionPoolException,
  StudentLicenseMismatchException,
  StudentProfileInvalidException,
} from './domain/exceptions/exam.exceptions';
import { ExamSessionRepository } from './domain/repositories/exam-session.repository';
import { ExamTemplateRepository } from './domain/repositories/exam-template.repository';

function createTemplate() {
  return ExamTemplate.create({
    name: 'De thi B2',
    description: 'De thi B2 strict distribution',
    licenseCategory: LicenseCategory.B2,
    totalQuestions: 2,
    passingScore: 2,
    durationMinutes: 20,
    criticalQuestions: 1,
    maxCriticalMistakes: 0,
    shuffleQuestions: false,
    topicDistribution: [{ topicId: 'topic-1', questionCount: 2 }],
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
    maxCriticalMistakes: 0,
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

function createExpiredSession() {
  const now = new Date();
  return ExamSession.reconstitute({
    id: 'session-id',
    studentId: 'student-id',
    templateId: 'template-id',
    licenseCategory: LicenseCategory.B2,
    passingScore: 2,
    durationMinutes: 20,
    maxCriticalMistakes: 0,
    status: ExamSessionStatus.IN_PROGRESS,
    score: null,
    isPassed: null,
    failedByCritical: false,
    criticalMistakes: 0,
    startedAt: new Date(now.getTime() - 30 * 60_000),
    finishedAt: null,
    expiresAt: new Date(now.getTime() - 10 * 60_000),
    createdAt: new Date(now.getTime() - 30 * 60_000),
    updatedAt: new Date(now.getTime() - 30 * 60_000),
    questions: [
      {
        questionId: 'q1',
        questionContent: 'Question 1',
        correctOptionId: 'q1-o1',
        isCritical: false,
        displayOrder: 1,
        selectedOptionId: 'q1-o1',
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
    expect(session.criticalMistakes).toBe(1);
  });

  it('passes when critical mistakes are within configured threshold', () => {
    const session = ExamSession.create({
      studentId: 'student-id',
      templateId: 'template-id',
      licenseCategory: LicenseCategory.B2,
      passingScore: 1,
      durationMinutes: 20,
      maxCriticalMistakes: 1,
      questions: [
        {
          questionId: 'q1',
          questionContent: 'Question 1',
          correctOptionId: 'q1-o1',
          isCritical: true,
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
          isCritical: false,
          displayOrder: 2,
          optionsSnapshot: [
            { id: 'q2-o1', content: 'A', displayOrder: 1 },
            { id: 'q2-o2', content: 'B', displayOrder: 2 },
          ],
        },
      ],
    });
    session.saveAnswer('q1', 'q1-o2');
    session.saveAnswer('q2', 'q2-o1');

    session.submit();

    expect(session.score).toBe(1);
    expect(session.criticalMistakes).toBe(1);
    expect(session.failedByCritical).toBe(false);
    expect(session.isPassed).toBe(true);
  });

  it('rejects double submit', () => {
    const session = createSession();
    session.submit();

    expect(() => session.submit()).toThrow(ExamSessionAlreadyFinishedException);
  });

  it('finalizes an expired in-progress session as timed out', () => {
    const session = createExpiredSession();

    const finalized = session.expireIfNeeded();

    expect(finalized).toBe(true);
    expect(session.status).toBe(ExamSessionStatus.TIMED_OUT);
    expect(session.score).toBe(1);
    expect(session.finishedAt).toBeInstanceOf(Date);
  });
});

describe('ExamTemplate domain', () => {
  it('rejects topic distribution totals that do not match totalQuestions', () => {
    expect(() =>
      ExamTemplate.create({
        name: 'Invalid template',
        description: null,
        licenseCategory: LicenseCategory.B2,
        totalQuestions: 2,
        passingScore: 1,
        durationMinutes: 20,
        criticalQuestions: 1,
        maxCriticalMistakes: 0,
        shuffleQuestions: true,
        topicDistribution: [{ topicId: 'topic-1', questionCount: 1 }],
        createdById: 'admin-id',
      }),
    ).toThrow(InvalidExamTemplateException);
  });

  it('rejects duplicate topic ids', () => {
    expect(() =>
      ExamTemplate.create({
        name: 'Invalid template',
        description: null,
        licenseCategory: LicenseCategory.B2,
        totalQuestions: 2,
        passingScore: 1,
        durationMinutes: 20,
        criticalQuestions: 1,
        maxCriticalMistakes: 0,
        shuffleQuestions: true,
        topicDistribution: [
          { topicId: 'topic-1', questionCount: 1 },
          { topicId: 'topic-1', questionCount: 1 },
        ],
        createdById: 'admin-id',
      }),
    ).toThrow(InvalidExamTemplateException);
  });

  it('rejects maxCriticalMistakes greater than criticalQuestions', () => {
    expect(() =>
      ExamTemplate.create({
        name: 'Invalid template',
        description: null,
        licenseCategory: LicenseCategory.B2,
        totalQuestions: 2,
        passingScore: 1,
        durationMinutes: 20,
        criticalQuestions: 1,
        maxCriticalMistakes: 2,
        shuffleQuestions: true,
        topicDistribution: [{ topicId: 'topic-1', questionCount: 2 }],
        createdById: 'admin-id',
      }),
    ).toThrow(InvalidExamTemplateException);
  });
});

describe('Exam use cases', () => {
  let templateRepository: jest.Mocked<ExamTemplateRepository>;
  let sessionRepository: jest.Mocked<ExamSessionRepository>;
  let questionPoolClient: jest.Mocked<QuestionPoolClient>;
  let userProfileClient: jest.Mocked<UserProfileClient>;
  let eventPublisher: jest.Mocked<EventPublisher>;
  let metricsService: {
    recordExamSessionStarted: jest.Mock;
    recordExamSessionCompleted: jest.Mock;
  };

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
      findMissedQuestions: jest.fn(),
      save: jest.fn(),
    };
    questionPoolClient = { getPool: jest.fn() };
    userProfileClient = { getCurrentStudentProfile: jest.fn() };
    eventPublisher = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    };
    metricsService = {
      recordExamSessionStarted: jest.fn(),
      recordExamSessionCompleted: jest.fn(),
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
        imageUrl: null,
        mediaFileId: null,
        isCritical: false,
        topicId: 'topic-1',
        options: [
          { id: 'q1-o1', content: 'A', isCorrect: true, displayOrder: 1 },
          { id: 'q1-o2', content: 'B', isCorrect: false, displayOrder: 2 },
        ],
      },
      {
        id: 'q2',
        content: 'Question 2',
        imageUrl: null,
        mediaFileId: null,
        isCritical: true,
        topicId: 'topic-1',
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
      metricsService as never,
    );
    const result = await useCase.execute(
      new StartSessionCommand('template-id', 'student-id', 'token'),
    );

    expect(result.questions).toHaveLength(2);
    expect(questionPoolClient.getPool).toHaveBeenCalledWith({
      licenseCategory: LicenseCategory.B2,
      size: 2,
      topicId: 'topic-1',
    });
    expect(sessionRepository.save).toHaveBeenCalledTimes(1);
    expect(metricsService.recordExamSessionStarted).toHaveBeenCalledWith({
      licenseCategory: LicenseCategory.B2,
    });
  });

  it('lists available exams for the current student license tier', async () => {
    const template = createTemplate();
    userProfileClient.getCurrentStudentProfile.mockResolvedValue({
      id: 'student-id',
      role: 'STUDENT',
      isActive: true,
      studentDetail: { licenseTier: LicenseCategory.B2 },
    });
    templateRepository.findAll.mockResolvedValue({
      items: [template],
      total: 1,
    });

    const useCase = new ListAvailableExamsUseCase(
      templateRepository,
      userProfileClient,
    );
    const result = await useCase.execute(
      new ListAvailableExamsQuery('student-id', 'token', 1, 20),
    );

    expect(templateRepository.findAll).toHaveBeenCalledWith({
      page: 1,
      size: 20,
      licenseCategory: LicenseCategory.B2,
      isActive: true,
      includeDeleted: false,
    });
    expect(result.items).toEqual([
      {
        id: template.id,
        name: template.name,
        description: template.description,
        licenseCategory: template.licenseCategory,
        totalQuestions: template.totalQuestions,
        passingScore: template.passingScore,
        durationMinutes: template.durationMinutes,
        criticalQuestions: template.criticalQuestions,
        maxCriticalMistakes: template.maxCriticalMistakes,
        shuffleQuestions: template.shuffleQuestions,
      },
    ]);
  });

  it('returns an empty available exam list when student has no license tier', async () => {
    userProfileClient.getCurrentStudentProfile.mockResolvedValue({
      id: 'student-id',
      role: 'STUDENT',
      isActive: true,
      studentDetail: { licenseTier: null },
    });

    const useCase = new ListAvailableExamsUseCase(
      templateRepository,
      userProfileClient,
    );
    const result = await useCase.execute(
      new ListAvailableExamsQuery('student-id', 'token', 1, 20),
    );

    expect(templateRepository.findAll).not.toHaveBeenCalled();
    expect(result).toMatchObject({ items: [], total: 0, page: 1, size: 20 });
  });

  it('rejects available exams when current profile is not an active student', async () => {
    userProfileClient.getCurrentStudentProfile.mockResolvedValue({
      id: 'student-id',
      role: 'INSTRUCTOR',
      isActive: true,
      studentDetail: null,
    });

    const useCase = new ListAvailableExamsUseCase(
      templateRepository,
      userProfileClient,
    );

    await expect(
      useCase.execute(
        new ListAvailableExamsQuery('student-id', 'token', 1, 20),
      ),
    ).rejects.toBeInstanceOf(StudentProfileInvalidException);
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
      metricsService as never,
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
      metricsService as never,
    );

    await expect(
      useCase.execute(
        new StartSessionCommand('template-id', 'student-id', 'token'),
      ),
    ).rejects.toBeInstanceOf(InsufficientQuestionPoolException);
  });

  it('enforces required critical questions by replacing non-critical questions in the same topic', async () => {
    templateRepository.findById.mockResolvedValue(createTemplate());
    userProfileClient.getCurrentStudentProfile.mockResolvedValue({
      id: 'student-id',
      role: 'STUDENT',
      isActive: true,
      studentDetail: { licenseTier: LicenseCategory.B2 },
    });
    questionPoolClient.getPool
      .mockResolvedValueOnce([
        {
          id: 'q1',
          content: 'Question 1',
          imageUrl: null,
          mediaFileId: null,
          isCritical: false,
          topicId: 'topic-1',
          options: [
            { id: 'q1-o1', content: 'A', isCorrect: true, displayOrder: 1 },
            { id: 'q1-o2', content: 'B', isCorrect: false, displayOrder: 2 },
          ],
        },
        {
          id: 'q2',
          content: 'Question 2',
          imageUrl: 'https://blob/q2.png',
          mediaFileId: 'media-q2',
          isCritical: false,
          topicId: 'topic-1',
          options: [
            { id: 'q2-o1', content: 'A', isCorrect: true, displayOrder: 1 },
            { id: 'q2-o2', content: 'B', isCorrect: false, displayOrder: 2 },
          ],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'q3',
          content: 'Question 3',
          imageUrl: null,
          mediaFileId: null,
          isCritical: true,
          topicId: 'topic-1',
          options: [
            { id: 'q3-o1', content: 'A', isCorrect: true, displayOrder: 1 },
            { id: 'q3-o2', content: 'B', isCorrect: false, displayOrder: 2 },
          ],
        },
      ]);

    const useCase = new StartSessionUseCase(
      templateRepository,
      sessionRepository,
      questionPoolClient,
      userProfileClient,
      metricsService as never,
    );
    const result = await useCase.execute(
      new StartSessionCommand('template-id', 'student-id', 'token'),
    );

    expect(result.questions).toHaveLength(2);
    expect(
      result.questions.filter((question) => question.isCritical),
    ).toHaveLength(1);
    expect(questionPoolClient.getPool).toHaveBeenNthCalledWith(2, {
      licenseCategory: LicenseCategory.B2,
      size: 1,
      topicId: 'topic-1',
      isCritical: true,
      excludeQuestionIds: ['q1', 'q2'],
    });
  });

  it('publishes events after submit save', async () => {
    const session = createSession();
    session.saveAnswer('q1', 'q1-o1');
    session.saveAnswer('q2', 'q2-o1');
    sessionRepository.findById.mockResolvedValue(session);

    const useCase = new SubmitSessionUseCase(
      sessionRepository,
      eventPublisher,
      metricsService as never,
    );
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
    expect(metricsService.recordExamSessionCompleted).toHaveBeenCalledWith({
      licenseCategory: LicenseCategory.B2,
      status: ExamSessionStatus.COMPLETED,
      result: 'pass',
      failedByCritical: false,
    });
  });

  it('lazily finalizes an expired session before returning its result', async () => {
    const session = createExpiredSession();
    sessionRepository.findById.mockResolvedValue(session);

    const useCase = new GetSessionResultUseCase(
      sessionRepository,
      eventPublisher,
    );
    const result = await useCase.execute(
      new GetSessionResultQuery('session-id', 'student-id'),
    );

    expect(result.status).toBe(ExamSessionStatus.TIMED_OUT);
    expect(result.score).toBe(1);
    expect(sessionRepository.save).toHaveBeenCalledWith(session);
    expect(eventPublisher.publishAll).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ eventName: 'exam.session.completed' }),
        expect.objectContaining({ eventName: 'exam.session.failed' }),
      ]),
    );
  });
});
