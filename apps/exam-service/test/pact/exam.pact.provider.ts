import fs from 'node:fs';
import path from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { VerifierOptions } from '@pact-foundation/pact';
import { Verifier } from '@pact-foundation/pact';
import { ApiExceptionFilter, ApiResponseInterceptor } from '@repo/common';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { CreateTemplateUseCase } from '../../src/application/use-cases/create-template/create-template.use-case';
import { DeleteTemplateUseCase } from '../../src/application/use-cases/delete-template/delete-template.use-case';
import { GetSessionQuestionsUseCase } from '../../src/application/use-cases/get-session-questions/get-session-questions.use-case';
import { GetSessionResultUseCase } from '../../src/application/use-cases/get-session-result/get-session-result.use-case';
import { GetTemplateUseCase } from '../../src/application/use-cases/get-template/get-template.use-case';
import { ListAvailableExamsUseCase } from '../../src/application/use-cases/list-available-exams/list-available-exams.use-case';
import { ListMissedQuestionsUseCase } from '../../src/application/use-cases/list-missed-questions/list-missed-questions.use-case';
import { ListSessionsUseCase } from '../../src/application/use-cases/list-sessions/list-sessions.use-case';
import { ListTemplatesUseCase } from '../../src/application/use-cases/list-templates/list-templates.use-case';
import { SaveAnswerUseCase } from '../../src/application/use-cases/save-answer/save-answer.use-case';
import { StartSessionUseCase } from '../../src/application/use-cases/start-session/start-session.use-case';
import { SubmitSessionUseCase } from '../../src/application/use-cases/submit-session/submit-session.use-case';
import { UpdateTemplateUseCase } from '../../src/application/use-cases/update-template/update-template.use-case';
import {
  ExamTemplateNotFoundException,
  ExamTemplateVersionConflictException,
} from '../../src/domain/exceptions/exam.exceptions';
import { DomainExceptionFilter } from '../../src/infrastructure/filters/domain-exception.filter';
import { AdminExamSessionController } from '../../src/presentation/http/admin-exam-session.controller';
import { ExamController } from '../../src/presentation/http/exam.controller';
import { ExamReviewController } from '../../src/presentation/http/exam-review.controller';
import { ExamSessionController } from '../../src/presentation/http/exam-session.controller';
import { ExamTemplateController } from '../../src/presentation/http/exam-template.controller';

type StateHandlers = NonNullable<VerifierOptions['stateHandlers']>;
type UseCaseMock = {
  execute: (...args: unknown[]) => Promise<unknown>;
  resolves: (value: unknown) => void;
  rejects: (error: unknown) => void;
};

const pactAdminId = '550e8400-e29b-41d4-a716-446655440100';
const pactOptionId = '550e8400-e29b-41d4-a716-446655440301';
const pactQuestionId = '550e8400-e29b-41d4-a716-446655440300';
const pactSessionId = '550e8400-e29b-41d4-a716-446655440200';
const pactStudentId = '550e8400-e29b-41d4-a716-446655440010';
const pactTemplateId = '550e8400-e29b-41d4-a716-446655440000';
const pactTopicId = '550e8400-e29b-41d4-a716-446655440400';
const pactNow = new Date('2026-06-01T00:00:00.000Z');
const pactFinishedAt = new Date('2026-06-01T00:15:00.000Z');
const pactExpiresAt = new Date('2026-06-01T00:20:00.000Z');

const expectedPactFiles = [
  'drivemate-mobile-exam-service.json',
  'drivemate-admin-exam-service.json',
];

function createUseCaseMock(): UseCaseMock {
  let handler = async (): Promise<unknown> => undefined;
  return {
    execute: (..._args: unknown[]) => handler(),
    resolves: (value: unknown) => {
      handler = async () => value;
    },
    rejects: (error: unknown) => {
      handler = async () => {
        throw error;
      };
    },
  };
}

const listAvailableExamsUseCase = createUseCaseMock();
const startSessionUseCase = createUseCaseMock();
const saveAnswerUseCase = createUseCaseMock();
const submitSessionUseCase = createUseCaseMock();
const getSessionQuestionsUseCase = createUseCaseMock();
const getSessionResultUseCase = createUseCaseMock();
const listSessionsUseCase = createUseCaseMock();
const createTemplateUseCase = createUseCaseMock();
const updateTemplateUseCase = createUseCaseMock();
const deleteTemplateUseCase = createUseCaseMock();
const getTemplateUseCase = createUseCaseMock();
const listTemplatesUseCase = createUseCaseMock();
const listMissedQuestionsUseCase = createUseCaseMock();

function resolvePactUrls(provider: string): string[] {
  if (process.env.PACT_URLS) {
    return process.env.PACT_URLS.split(',')
      .map((url) => url.trim())
      .filter(Boolean)
      .map((url) => path.resolve(url));
  }

  const pactDir = path.resolve(
    process.env.PACT_DIR ?? path.resolve(__dirname, '../../../../pacts'),
  );
  const expectedUrls = expectedPactFiles
    .map((fileName) => path.join(pactDir, fileName))
    .filter((filePath) => fs.existsSync(filePath));
  const discoveredUrls = fs.existsSync(pactDir)
    ? fs
        .readdirSync(pactDir)
        .filter(
          (fileName) =>
            fileName.endsWith('.json') && fileName.includes(provider),
        )
        .map((fileName) => path.join(pactDir, fileName))
    : [];

  const pactUrls = Array.from(new Set([...expectedUrls, ...discoveredUrls]));
  if (pactUrls.length > 0 || process.env.PACT_SKIP_MISSING === 'true') {
    return pactUrls;
  }

  throw new Error(
    [
      `No pact files found for ${provider}.`,
      `Expected files in ${pactDir}: ${expectedPactFiles.join(', ')}`,
      'Set PACT_DIR, PACT_URLS, or PACT_SKIP_MISSING=true for a dry local run.',
    ].join(' '),
  );
}

function topicDistributionItem() {
  return {
    topicId: pactTopicId,
    questionCount: 30,
  };
}

function templateResult(overrides = {}) {
  return {
    id: pactTemplateId,
    name: 'De thi B1',
    description: null,
    licenseCategory: 'B1',
    totalQuestions: 30,
    passingScore: 26,
    durationMinutes: 20,
    criticalQuestions: 1,
    maxCriticalMistakes: 0,
    shuffleQuestions: true,
    topicDistribution: [topicDistributionItem()],
    isActive: true,
    isDeleted: false,
    version: 1,
    createdById: pactAdminId,
    createdAt: pactNow,
    updatedAt: pactNow,
    ...overrides,
  };
}

function availableExamResult() {
  return {
    id: pactTemplateId,
    name: 'De thi B1',
    description: null,
    licenseCategory: 'B1',
    totalQuestions: 30,
    passingScore: 26,
    durationMinutes: 20,
    criticalQuestions: 1,
    maxCriticalMistakes: 0,
    shuffleQuestions: true,
  };
}

function sessionQuestion(overrides = {}) {
  return {
    questionId: pactQuestionId,
    content: 'Noi dung cau hoi',
    imageUrl: null,
    mediaFileId: null,
    options: [
      {
        id: pactOptionId,
        content: 'Dap an A',
        displayOrder: 1,
      },
    ],
    displayOrder: 1,
    isBookmarked: false,
    selectedOptionId: null,
    ...overrides,
  };
}

function sessionResult(overrides = {}) {
  return {
    id: pactSessionId,
    studentId: pactStudentId,
    templateId: pactTemplateId,
    licenseCategory: 'B1',
    status: 'IN_PROGRESS',
    score: null,
    isPassed: null,
    failedByCritical: false,
    criticalMistakes: 0,
    maxCriticalMistakes: 0,
    startedAt: pactNow,
    finishedAt: null,
    expiresAt: pactExpiresAt,
    questions: [sessionQuestion()],
    ...overrides,
  };
}

function completedSessionResult() {
  return sessionResult({
    status: 'COMPLETED',
    score: 28,
    isPassed: true,
    finishedAt: pactFinishedAt,
    questions: [
      sessionQuestion({
        selectedOptionId: pactOptionId,
        isCorrect: true,
      }),
    ],
  });
}

function arrangeDefaultProviderState() {
  listAvailableExamsUseCase.resolves({
    items: [availableExamResult()],
    total: 1,
    page: 1,
    size: 20,
  });
  startSessionUseCase.resolves(sessionResult());
  saveAnswerUseCase.resolves(
    sessionResult({
      questions: [
        sessionQuestion({
          isBookmarked: true,
          selectedOptionId: pactOptionId,
        }),
      ],
    }),
  );
  submitSessionUseCase.resolves(completedSessionResult());
  getSessionQuestionsUseCase.resolves(sessionResult());
  getSessionResultUseCase.resolves(completedSessionResult());
  listSessionsUseCase.resolves({
    items: [sessionResult()],
    total: 1,
    page: 1,
    size: 20,
  });
  createTemplateUseCase.resolves(templateResult());
  updateTemplateUseCase.resolves(
    templateResult({
      name: 'De thi B1 cap nhat',
      version: 2,
      updatedAt: pactFinishedAt,
    }),
  );
  deleteTemplateUseCase.resolves(
    templateResult({
      isActive: false,
      isDeleted: true,
      version: 2,
      updatedAt: pactFinishedAt,
    }),
  );
  getTemplateUseCase.resolves(templateResult());
  listTemplatesUseCase.resolves({
    items: [templateResult()],
    total: 1,
    page: 1,
    size: 20,
  });
  listMissedQuestionsUseCase.resolves([
    {
      questionId: pactQuestionId,
      content: 'Noi dung cau hoi',
      imageUrl: null,
      mediaFileId: null,
      options: [
        {
          id: pactOptionId,
          content: 'Dap an A',
          displayOrder: 1,
        },
      ],
      lastAnsweredAt: pactFinishedAt,
      missedCount: 3,
    },
  ]);
}

function providerValues() {
  return {
    adminId: pactAdminId,
    optionId: pactOptionId,
    questionId: pactQuestionId,
    sessionId: pactSessionId,
    studentId: pactStudentId,
    templateId: pactTemplateId,
    topicId: pactTopicId,
  };
}

function assignControllerDependencies<T extends object>(
  controller: T,
  dependencies: Record<string, unknown>,
) {
  Object.assign(controller, dependencies);
}

const defaultStateHandler = async () => {
  arrangeDefaultProviderState();
  return providerValues();
};

const stateHandlers: StateHandlers = {
  'a student with matching license has available exams': defaultStateHandler,
  'an active exam template exists': defaultStateHandler,
  'an exam template exists': defaultStateHandler,
  'an in-progress exam session exists for the student': defaultStateHandler,
  'a completed exam session exists for the student': defaultStateHandler,
  'exam sessions exist': defaultStateHandler,
  'missed question history exists for the student': defaultStateHandler,
  'an exam template version conflict exists': async () => {
    arrangeDefaultProviderState();
    // Throw the real domain exception - DomainExceptionFilter maps it to HTTP 409
    // with code EXAM_TEMPLATE_VERSION_CONFLICT, matching the production filter chain.
    updateTemplateUseCase.rejects(new ExamTemplateVersionConflictException());
    return providerValues();
  },
  'an exam template does not exist': async () => {
    arrangeDefaultProviderState();
    // Throw the real domain exception - DomainExceptionFilter maps it to HTTP 404
    // with code EXAM_TEMPLATE_NOT_FOUND.
    getTemplateUseCase.rejects(new ExamTemplateNotFoundException());
    return providerValues();
  },
};

const injectPactAuth: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  req.headers.authorization ??= 'Bearer pact-test-token';
  req.headers['x-user-id'] ??= pactStudentId;
  next();
};

async function createProviderApp(): Promise<{
  app: INestApplication;
  providerBaseUrl: string;
}> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    controllers: [
      ExamController,
      ExamSessionController,
      ExamTemplateController,
      ExamReviewController,
      AdminExamSessionController,
    ],
    providers: [
      {
        provide: ListAvailableExamsUseCase,
        useValue: listAvailableExamsUseCase,
      },
      { provide: StartSessionUseCase, useValue: startSessionUseCase },
      { provide: SaveAnswerUseCase, useValue: saveAnswerUseCase },
      { provide: SubmitSessionUseCase, useValue: submitSessionUseCase },
      {
        provide: GetSessionQuestionsUseCase,
        useValue: getSessionQuestionsUseCase,
      },
      { provide: GetSessionResultUseCase, useValue: getSessionResultUseCase },
      { provide: ListSessionsUseCase, useValue: listSessionsUseCase },
      { provide: CreateTemplateUseCase, useValue: createTemplateUseCase },
      { provide: UpdateTemplateUseCase, useValue: updateTemplateUseCase },
      { provide: DeleteTemplateUseCase, useValue: deleteTemplateUseCase },
      { provide: GetTemplateUseCase, useValue: getTemplateUseCase },
      { provide: ListTemplatesUseCase, useValue: listTemplatesUseCase },
      {
        provide: ListMissedQuestionsUseCase,
        useValue: listMissedQuestionsUseCase,
      },
    ],
  }).compile();

  assignControllerDependencies(moduleFixture.get(ExamController), {
    listAvailableExamsUseCase,
  });
  assignControllerDependencies(moduleFixture.get(ExamSessionController), {
    startSessionUseCase,
    saveAnswerUseCase,
    submitSessionUseCase,
    getSessionQuestionsUseCase,
    getSessionResultUseCase,
    listSessionsUseCase,
  });
  assignControllerDependencies(moduleFixture.get(ExamTemplateController), {
    createTemplateUseCase,
    updateTemplateUseCase,
    deleteTemplateUseCase,
    getTemplateUseCase,
    listTemplatesUseCase,
  });
  assignControllerDependencies(moduleFixture.get(ExamReviewController), {
    listMissedQuestionsUseCase,
  });
  assignControllerDependencies(moduleFixture.get(AdminExamSessionController), {
    listSessionsUseCase,
  });

  const app = moduleFixture.createNestApplication();
  app.use(
    (req: Request & { user?: unknown }, _res: Response, next: NextFunction) => {
      req.user = { sub: req.header('x-user-id') ?? pactStudentId };
      next();
    },
  );
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  // Register both filters in the same order as production main.ts.
  // DomainExceptionFilter must come after ApiExceptionFilter so Nest applies
  // more-specific filters (DomainException) first.
  app.useGlobalFilters(new ApiExceptionFilter(), new DomainExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  await app.listen(0, '127.0.0.1');
  return { app, providerBaseUrl: await app.getUrl() };
}

async function main() {
  const pactUrls = resolvePactUrls('exam-service');
  arrangeDefaultProviderState();
  const { app, providerBaseUrl } = await createProviderApp();
  try {
    if (pactUrls.length === 0) {
      console.log(
        'Skipping exam-service Pact verification because PACT_SKIP_MISSING=true and no pact files were found.',
      );
      return;
    }

    await new Verifier({
      provider: 'exam-service',
      providerBaseUrl,
      pactUrls,
      requestFilter: injectPactAuth,
      stateHandlers,
      beforeEach: async () => arrangeDefaultProviderState(),
      failIfNoPactsFound: true,
      logLevel: (process.env.PACT_LOG_LEVEL ??
        'info') as VerifierOptions['logLevel'],
    }).verifyProvider();
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
