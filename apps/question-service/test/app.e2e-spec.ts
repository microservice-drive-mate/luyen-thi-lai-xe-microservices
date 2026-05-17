import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiResponseInterceptor } from '@repo/common';
import { QuestionController } from '../src/presentation/http/question.controller';
import { CreateQuestionUseCase } from '../src/application/use-cases/create-question/create-question.use-case';
import { UpdateQuestionUseCase } from '../src/application/use-cases/update-question/update-question.use-case';
import { DeleteQuestionUseCase } from '../src/application/use-cases/delete-question/delete-question.use-case';
import { GetQuestionUseCase } from '../src/application/use-cases/get-question/get-question.use-case';
import { ListQuestionsUseCase } from '../src/application/use-cases/list-questions/list-questions.use-case';
import { GetQuestionPoolUseCase } from '../src/application/use-cases/get-question-pool/get-question-pool.use-case';
import { CreateTopicUseCase } from '../src/application/use-cases/create-topic/create-topic.use-case';
import { UpdateTopicUseCase } from '../src/application/use-cases/update-topic/update-topic.use-case';
import { GetTopicUseCase } from '../src/application/use-cases/get-topic/get-topic.use-case';
import { ListTopicsUseCase } from '../src/application/use-cases/list-topics/list-topics.use-case';

describe('QuestionController (e2e smoke)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [QuestionController],
      providers: [
        { provide: CreateQuestionUseCase, useValue: { execute: jest.fn() } },
        { provide: UpdateQuestionUseCase, useValue: { execute: jest.fn() } },
        { provide: DeleteQuestionUseCase, useValue: { execute: jest.fn() } },
        { provide: GetQuestionUseCase, useValue: { execute: jest.fn() } },
        {
          provide: ListQuestionsUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              items: [],
              total: 0,
              page: 1,
              size: 20,
            }),
          },
        },
        { provide: GetQuestionPoolUseCase, useValue: { execute: jest.fn() } },
        { provide: CreateTopicUseCase, useValue: { execute: jest.fn() } },
        { provide: UpdateTopicUseCase, useValue: { execute: jest.fn() } },
        { provide: GetTopicUseCase, useValue: { execute: jest.fn() } },
        { provide: ListTopicsUseCase, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });

  it('GET /admin/questions returns the shared response envelope', async () => {
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

  afterEach(async () => {
    await app.close();
  });
});
