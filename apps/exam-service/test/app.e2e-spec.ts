import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiResponseInterceptor } from '@repo/common';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { CreateTemplateUseCase } from '../src/application/use-cases/create-template/create-template.use-case';
import { DeleteTemplateUseCase } from '../src/application/use-cases/delete-template/delete-template.use-case';
import { GetSessionQuestionsUseCase } from '../src/application/use-cases/get-session-questions/get-session-questions.use-case';
import { GetSessionResultUseCase } from '../src/application/use-cases/get-session-result/get-session-result.use-case';
import { GetTemplateUseCase } from '../src/application/use-cases/get-template/get-template.use-case';
import { ListAvailableExamsUseCase } from '../src/application/use-cases/list-available-exams/list-available-exams.use-case';
import { ListMissedQuestionsUseCase } from '../src/application/use-cases/list-missed-questions/list-missed-questions.use-case';
import { ListSessionsUseCase } from '../src/application/use-cases/list-sessions/list-sessions.use-case';
import { ListTemplatesUseCase } from '../src/application/use-cases/list-templates/list-templates.use-case';
import { SaveAnswerUseCase } from '../src/application/use-cases/save-answer/save-answer.use-case';
import { StartSessionUseCase } from '../src/application/use-cases/start-session/start-session.use-case';
import { SubmitSessionUseCase } from '../src/application/use-cases/submit-session/submit-session.use-case';
import { UpdateTemplateUseCase } from '../src/application/use-cases/update-template/update-template.use-case';
import { AdminExamSessionController } from '../src/presentation/http/admin-exam-session.controller';
import { ExamController } from '../src/presentation/http/exam.controller';
import { ExamReviewController } from '../src/presentation/http/exam-review.controller';
import { ExamSessionController } from '../src/presentation/http/exam-session.controller';
import { ExamTemplateController } from '../src/presentation/http/exam-template.controller';

describe('Exam service HTTP contract (e2e smoke)', () => {
  let app: INestApplication;

  const listAvailableExamsUseCase = { execute: jest.fn() };
  const startSessionUseCase = { execute: jest.fn() };
  const saveAnswerUseCase = { execute: jest.fn() };
  const submitSessionUseCase = { execute: jest.fn() };
  const getSessionQuestionsUseCase = { execute: jest.fn() };
  const getSessionResultUseCase = { execute: jest.fn() };
  const listSessionsUseCase = { execute: jest.fn() };
  const createTemplateUseCase = { execute: jest.fn() };
  const updateTemplateUseCase = { execute: jest.fn() };
  const deleteTemplateUseCase = { execute: jest.fn() };
  const getTemplateUseCase = { execute: jest.fn() };
  const listTemplatesUseCase = { execute: jest.fn() };
  const listMissedQuestionsUseCase = { execute: jest.fn() };

  const now = new Date('2026-06-01T00:00:00.000Z');
  const templateId = '550e8400-e29b-41d4-a716-446655440000';
  const questionId = '550e8400-e29b-41d4-a716-446655440001';
  const optionId = '550e8400-e29b-41d4-a716-446655440002';

  const sessionResult = (overrides = {}) => ({
    id: 'session-1',
    studentId: 'student-1',
    templateId,
    licenseCategory: 'B1',
    status: 'IN_PROGRESS',
    score: null,
    isPassed: null,
    failedByCritical: false,
    criticalMistakes: 0,
    maxCriticalMistakes: 1,
    startedAt: now,
    finishedAt: null,
    expiresAt: new Date('2026-06-01T00:20:00.000Z'),
    questions: [],
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

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

    app = moduleFixture.createNestApplication();
    app.use(
      (
        req: Request & { user?: unknown },
        _res: Response,
        next: NextFunction,
      ) => {
        req.user = { sub: req.header('x-user-id') ?? 'student-1' };
        next();
      },
    );
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /exams/available returns templates available to a student', async () => {
    listAvailableExamsUseCase.execute.mockResolvedValue({
      items: [
        {
          id: templateId,
          name: 'De thi B1',
          description: null,
          licenseCategory: 'B1',
          totalQuestions: 30,
          passingScore: 26,
          durationMinutes: 20,
          criticalQuestions: 1,
          maxCriticalMistakes: 0,
          shuffleQuestions: true,
        },
      ],
      total: 1,
      page: 1,
      size: 20,
    });

    await request(app.getHttpServer())
      .get('/exams/available')
      .set('x-user-id', 'student-1')
      .set('authorization', 'Bearer access-token')
      .expect(200)
      .expect((response) => {
        expect(response.body.data.items[0]).toMatchObject({
          id: templateId,
          licenseCategory: 'B1',
        });
      });
  });

  it('POST /exams/sessions starts a session', async () => {
    startSessionUseCase.execute.mockResolvedValue(sessionResult());

    await request(app.getHttpServer())
      .post('/exams/sessions')
      .set('x-user-id', 'student-1')
      .set('authorization', 'Bearer access-token')
      .send({ templateId })
      .expect(201)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          id: 'session-1',
          status: 'IN_PROGRESS',
          studentId: 'student-1',
        });
      });
  });

  it('PATCH /exams/sessions/:id/answers saves an answer draft', async () => {
    saveAnswerUseCase.execute.mockResolvedValue(
      sessionResult({
        questions: [
          {
            questionId,
            content: 'Noi dung cau hoi',
            imageUrl: null,
            mediaFileId: null,
            options: [{ id: optionId, content: 'Dap an A', displayOrder: 1 }],
            displayOrder: 1,
            isBookmarked: true,
            selectedOptionId: optionId,
          },
        ],
      }),
    );

    await request(app.getHttpServer())
      .patch('/exams/sessions/session-1/answers')
      .set('x-user-id', 'student-1')
      .send({ questionId, selectedOptionId: optionId, isBookmarked: true })
      .expect(200)
      .expect((response) => {
        expect(response.body.data.questions[0]).toMatchObject({
          questionId,
          selectedOptionId: optionId,
          isBookmarked: true,
        });
      });
  });

  it('POST /exams/sessions/:id/submit returns graded result', async () => {
    submitSessionUseCase.execute.mockResolvedValue(
      sessionResult({
        status: 'COMPLETED',
        score: 28,
        isPassed: true,
        finishedAt: new Date('2026-06-01T00:15:00.000Z'),
      }),
    );

    await request(app.getHttpServer())
      .post('/exams/sessions/session-1/submit')
      .set('x-user-id', 'student-1')
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          status: 'COMPLETED',
          score: 28,
          isPassed: true,
        });
      });
  });
});
