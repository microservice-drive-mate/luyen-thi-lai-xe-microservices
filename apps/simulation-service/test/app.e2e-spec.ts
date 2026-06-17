import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiResponseInterceptor } from '@repo/common';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import {
  GetManeuverUseCase,
  GetSimulationSessionResultUseCase,
  ListManeuverErrorsUseCase,
  ListManeuversUseCase,
  ListSimulationSessionsUseCase,
  SaveSimulationAnswerUseCase,
  StartSimulationSessionUseCase,
  SubmitSimulationSessionUseCase,
} from '../src/application/use-cases/simulation.use-cases';
import {
  EndPractice2dSessionUseCase,
  GetPractice2dSessionUseCase,
  IngestPractice2dTelemetryUseCase,
  StartPractice2dSessionUseCase,
} from '../src/application/use-cases/practice2d/practice2d.use-cases';
import { SimulationController } from '../src/presentation/http/simulation.controller';

describe('Simulation service HTTP contract (e2e smoke)', () => {
  let app: INestApplication;

  const listManeuversUseCase = { execute: jest.fn() };
  const getManeuverUseCase = { execute: jest.fn() };
  const listManeuverErrorsUseCase = { execute: jest.fn() };
  const startSimulationSessionUseCase = { execute: jest.fn() };
  const saveSimulationAnswerUseCase = { execute: jest.fn() };
  const submitSimulationSessionUseCase = { execute: jest.fn() };
  const listSimulationSessionsUseCase = { execute: jest.fn() };
  const getSimulationSessionResultUseCase = { execute: jest.fn() };
  const startPractice2dSessionUseCase = { execute: jest.fn() };
  const ingestPractice2dTelemetryUseCase = { execute: jest.fn() };
  const endPractice2dSessionUseCase = { execute: jest.fn() };
  const getPractice2dSessionUseCase = { execute: jest.fn() };

  const now = new Date('2026-06-01T00:00:00.000Z');

  const practiceSession = (overrides = {}) => ({
    id: 'practice-1',
    studentId: 'student-1',
    licenseCategory: 'B1',
    status: 'IN_PROGRESS',
    totalEvents: 0,
    errorCount: 0,
    totalPenalty: 0,
    score: null,
    summary: {},
    startedAt: now,
    endedAt: null,
    feedbackEvents: [],
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SimulationController],
      providers: [
        { provide: ListManeuversUseCase, useValue: listManeuversUseCase },
        { provide: GetManeuverUseCase, useValue: getManeuverUseCase },
        {
          provide: ListManeuverErrorsUseCase,
          useValue: listManeuverErrorsUseCase,
        },
        {
          provide: StartSimulationSessionUseCase,
          useValue: startSimulationSessionUseCase,
        },
        {
          provide: SaveSimulationAnswerUseCase,
          useValue: saveSimulationAnswerUseCase,
        },
        {
          provide: SubmitSimulationSessionUseCase,
          useValue: submitSimulationSessionUseCase,
        },
        {
          provide: ListSimulationSessionsUseCase,
          useValue: listSimulationSessionsUseCase,
        },
        {
          provide: GetSimulationSessionResultUseCase,
          useValue: getSimulationSessionResultUseCase,
        },
        {
          provide: StartPractice2dSessionUseCase,
          useValue: startPractice2dSessionUseCase,
        },
        {
          provide: IngestPractice2dTelemetryUseCase,
          useValue: ingestPractice2dTelemetryUseCase,
        },
        {
          provide: EndPractice2dSessionUseCase,
          useValue: endPractice2dSessionUseCase,
        },
        {
          provide: GetPractice2dSessionUseCase,
          useValue: getPractice2dSessionUseCase,
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

  it('GET /simulation/maneuvers lists maneuvers by license category', async () => {
    listManeuversUseCase.execute.mockResolvedValue([
      {
        id: 'maneuver-1',
        title: 'Xuat phat',
        description: 'Bai thi xuat phat',
        licenseCategory: 'B1',
        displayOrder: 1,
        checkpoints: [
          {
            id: 'checkpoint-1',
            title: 'Bat dau',
            instruction: 'Bat dau dung cach',
            penalty: null,
            x: 10,
            y: 20,
            visualColor: '#22c55e',
            displayOrder: 1,
          },
        ],
      },
    ]);

    await request(app.getHttpServer())
      .get('/simulation/maneuvers?licenseCategory=B1')
      .expect(200)
      .expect((response) => {
        expect(response.body.data[0]).toMatchObject({
          id: 'maneuver-1',
          licenseCategory: 'B1',
        });
      });
  });

  it('POST /simulation/practice2d/sessions starts a 2D practice session', async () => {
    startPractice2dSessionUseCase.execute.mockResolvedValue(practiceSession());

    await request(app.getHttpServer())
      .post('/simulation/practice2d/sessions')
      .set('x-user-id', 'student-1')
      .send({
        licenseCategory: 'B1',
        clientCapabilities: { canvas: true, keyboard: true },
        persistTelemetry: false,
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          id: 'practice-1',
          status: 'IN_PROGRESS',
          studentId: 'student-1',
        });
      });
  });

  it('POST /simulation/practice2d/sessions/:id/telemetry returns feedback', async () => {
    ingestPractice2dTelemetryUseCase.execute.mockResolvedValue({
      id: 'feedback-1',
      telemetryType: 'speed',
      errorCode: 'OVER_SPEED',
      severity: 'WARNING',
      penalty: 5,
      message: 'Giam toc do.',
      hint: 'Giu toc do on dinh.',
      occurredAt: now,
    });

    await request(app.getHttpServer())
      .post('/simulation/practice2d/sessions/practice-1/telemetry')
      .set('x-user-id', 'student-1')
      .send({ type: 'speed', speedKmh: 45, collision: false })
      .expect(201)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          id: 'feedback-1',
          errorCode: 'OVER_SPEED',
          penalty: 5,
        });
      });
  });

  it('POST /simulation/practice2d/sessions/:id/end returns scoring summary', async () => {
    endPractice2dSessionUseCase.execute.mockResolvedValue(
      practiceSession({
        status: 'COMPLETED',
        totalEvents: 8,
        errorCount: 1,
        totalPenalty: 5,
        score: 95,
        endedAt: new Date('2026-06-01T00:10:00.000Z'),
      }),
    );

    await request(app.getHttpServer())
      .post('/simulation/practice2d/sessions/practice-1/end')
      .set('x-user-id', 'student-1')
      .send({ abandoned: false })
      .expect(201)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          status: 'COMPLETED',
          score: 95,
          totalPenalty: 5,
        });
      });
  });
});
