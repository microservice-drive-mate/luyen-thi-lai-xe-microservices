import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiResponseInterceptor } from '@repo/common';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { CreateQuestionUseCase } from '../src/application/use-cases/create-question/create-question.use-case';
import { CreateTopicUseCase } from '../src/application/use-cases/create-topic/create-topic.use-case';
import { DeleteQuestionUseCase } from '../src/application/use-cases/delete-question/delete-question.use-case';
import { GetQuestionPoolUseCase } from '../src/application/use-cases/get-question-pool/get-question-pool.use-case';
import { GetQuestionUseCase } from '../src/application/use-cases/get-question/get-question.use-case';
import { GetTopicUseCase } from '../src/application/use-cases/get-topic/get-topic.use-case';
import { ListQuestionsUseCase } from '../src/application/use-cases/list-questions/list-questions.use-case';
import { ListTopicsUseCase } from '../src/application/use-cases/list-topics/list-topics.use-case';
import { ReportQuestionUseCase } from '../src/application/use-cases/report-question/report-question.use-case';
import { UpdateQuestionUseCase } from '../src/application/use-cases/update-question/update-question.use-case';
import { UpdateTopicUseCase } from '../src/application/use-cases/update-topic/update-topic.use-case';
import { PublicQuestionController } from '../src/presentation/http/public-question.controller';
import { QuestionController } from '../src/presentation/http/question.controller';

describe('Question service HTTP contract (e2e smoke)', () => {
  let app: INestApplication;

  const createQuestionUseCase = { execute: jest.fn() };
  const updateQuestionUseCase = { execute: jest.fn() };
  const deleteQuestionUseCase = { execute: jest.fn() };
  const getQuestionUseCase = { execute: jest.fn() };
  const listQuestionsUseCase = { execute: jest.fn() };
  const getQuestionPoolUseCase = { execute: jest.fn() };
  const createTopicUseCase = { execute: jest.fn() };
  const updateTopicUseCase = { execute: jest.fn() };
  const getTopicUseCase = { execute: jest.fn() };
  const listTopicsUseCase = { execute: jest.fn() };
  const reportQuestionUseCase = { execute: jest.fn() };

  const now = new Date('2026-06-01T00:00:00.000Z');
  const questionId = '550e8400-e29b-41d4-a716-446655440010';

  const questionResult = {
    id: questionId,
    content: 'Khi gap den do, nguoi lai xe phai lam gi?',
    type: 'THEORY',
    licenseCategories: ['B1'],
    difficulty: 'EASY',
    explanation: 'Dung xe truoc vach dung.',
    imageUrl: null,
    mediaFileId: null,
    isCritical: false,
    isActive: true,
    isDeleted: false,
    topicId: 'topic-1',
    createdById: 'admin-1',
    version: 1,
    deletedById: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    options: [
      { id: 'option-1', content: 'Dung xe', isCorrect: true, displayOrder: 1 },
      {
        id: 'option-2',
        content: 'Tang toc vuot qua',
        isCorrect: false,
        displayOrder: 2,
      },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [QuestionController, PublicQuestionController],
      providers: [
        { provide: CreateQuestionUseCase, useValue: createQuestionUseCase },
        { provide: UpdateQuestionUseCase, useValue: updateQuestionUseCase },
        { provide: DeleteQuestionUseCase, useValue: deleteQuestionUseCase },
        { provide: GetQuestionUseCase, useValue: getQuestionUseCase },
        { provide: ListQuestionsUseCase, useValue: listQuestionsUseCase },
        { provide: GetQuestionPoolUseCase, useValue: getQuestionPoolUseCase },
        { provide: CreateTopicUseCase, useValue: createTopicUseCase },
        { provide: UpdateTopicUseCase, useValue: updateTopicUseCase },
        { provide: GetTopicUseCase, useValue: getTopicUseCase },
        { provide: ListTopicsUseCase, useValue: listTopicsUseCase },
        { provide: ReportQuestionUseCase, useValue: reportQuestionUseCase },
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

  it('GET /admin/questions returns the shared response envelope', async () => {
    listQuestionsUseCase.execute.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      size: 20,
    });

    await request(app.getHttpServer())
      .get('/admin/questions')
      .expect(200)
      .expect((response) => {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual({
          items: [],
          total: 0,
          page: 1,
          size: 20,
        });
      });
  });

  it('POST /admin/questions/pool returns an exam question pool', async () => {
    getQuestionPoolUseCase.execute.mockResolvedValue({
      items: [questionResult],
    });

    await request(app.getHttpServer())
      .post('/admin/questions/pool')
      .send({ licenseCategory: 'B1', size: 1, type: 'THEORY' })
      .expect(201)
      .expect((response) => {
        expect(response.body.data.items).toHaveLength(1);
        expect(response.body.data.items[0]).toMatchObject({
          id: questionId,
          licenseCategories: ['B1'],
        });
      });
  });

  it('GET /questions/practice hides answer keys from student practice payload', async () => {
    listQuestionsUseCase.execute.mockResolvedValue({
      items: [questionResult],
      total: 1,
      page: 1,
      size: 20,
    });

    await request(app.getHttpServer())
      .get('/questions/practice')
      .set('x-user-id', 'student-1')
      .expect(200)
      .expect((response) => {
        expect(response.body.data.items[0].options[0]).toEqual({
          id: 'option-1',
          content: 'Dung xe',
          displayOrder: 1,
        });
        expect(
          response.body.data.items[0].options[0].isCorrect,
        ).toBeUndefined();
      });
  });

  it('POST /questions/:id/report records a student report', async () => {
    reportQuestionUseCase.execute.mockResolvedValue({
      id: 'report-1',
      questionId,
      userId: 'student-1',
      reason: 'Sai dap an',
      message: 'Can kiem tra lai dap an dung.',
      status: 'OPEN',
      createdAt: now,
    });

    await request(app.getHttpServer())
      .post(`/questions/${questionId}/report`)
      .set('x-user-id', 'student-1')
      .send({ reason: 'Sai dap an', message: 'Can kiem tra lai dap an dung.' })
      .expect(201)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          id: 'report-1',
          questionId,
          userId: 'student-1',
        });
      });
  });
});
