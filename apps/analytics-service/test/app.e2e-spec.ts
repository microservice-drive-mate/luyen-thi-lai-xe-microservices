import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiResponseInterceptor } from '@repo/common';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { GetAdminDashboardUseCase } from '../src/application/use-cases/get-admin-dashboard/get-admin-dashboard.use-case';
import { GetInstructorDashboardUseCase } from '../src/application/use-cases/get-instructor-dashboard/get-instructor-dashboard.use-case';
import { GetProgressUseCase } from '../src/application/use-cases/get-progress/get-progress.use-case';
import { AdminDashboardController } from '../src/presentation/http/admin-dashboard.controller';
import { AnalyticsController } from '../src/presentation/http/analytics.controller';
import { InstructorDashboardController } from '../src/presentation/http/instructor-dashboard.controller';

describe('Analytics service HTTP contract (e2e smoke)', () => {
  let app: INestApplication;

  const getProgressUseCase = { execute: jest.fn() };
  const getAdminDashboardUseCase = { execute: jest.fn() };
  const getInstructorDashboardUseCase = { execute: jest.fn() };

  const now = new Date('2026-06-01T00:00:00.000Z');

  const progressDashboard = {
    studentId: 'student-1',
    completionPct: 75,
    studiedCount: 15,
    attemptCount: 4,
    passRate: 50,
    totalStudyMinutes: 180,
    avgExamScore: 24,
    trend: [
      {
        date: new Date().toISOString().slice(0, 10),
        attempts: 1,
        correctAnswers: 26,
        questionsAnswered: 30,
      },
    ],
    weakTopics: [
      {
        topicId: 'topic-1',
        topicName: 'Bien bao',
        incorrectCount: 3,
        accuracyRate: 70,
      },
    ],
    lastActivityAt: now,
  };

  const adminDashboard = {
    period: {
      month: '2026-06',
      currentFrom: now,
      currentTo: now,
      previousFrom: now,
      previousTo: now,
    },
    cards: [
      {
        key: 'students',
        label: 'Hoc vien',
        value: 12,
        previousValue: 10,
        delta: { value: 2, percentage: 20, direction: 'up' },
      },
    ],
    monthlyTrend: [],
    licenseDistribution: [],
    passRateByLicense: [],
    recentActivities: [],
  };

  const instructorDashboard = {
    period: {
      month: '2026-06',
      weekStart: '2026-06-08',
      date: '2026-06-13',
      timezone: 'Asia/Ho_Chi_Minh',
    },
    summary: {
      activeClassCount: 2,
      totalStudents: 30,
      passRate: 80,
      teachingHoursThisMonth: 24,
    },
    weeklyTeachingTrend: [],
    topicAverages: [],
    classProgress: [],
    todaySchedule: [],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        AnalyticsController,
        AdminDashboardController,
        InstructorDashboardController,
      ],
      providers: [
        { provide: GetProgressUseCase, useValue: getProgressUseCase },
        {
          provide: GetAdminDashboardUseCase,
          useValue: getAdminDashboardUseCase,
        },
        {
          provide: GetInstructorDashboardUseCase,
          useValue: getInstructorDashboardUseCase,
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
        req.user = {
          sub: req.header('x-user-id') ?? 'student-1',
          licenseTier: 'B1',
          license_category: 'B1',
        };
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

  it('GET /analytics/me/progress returns progress summary', async () => {
    getProgressUseCase.execute.mockResolvedValue(progressDashboard);

    await request(app.getHttpServer())
      .get('/analytics/me/progress')
      .set('x-user-id', 'student-1')
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          studentId: 'student-1',
          completionPct: 75,
          avgExamScore: 24,
        });
      });
  });

  it('GET /admin/analytics/dashboard returns admin metrics', async () => {
    getAdminDashboardUseCase.execute.mockResolvedValue(adminDashboard);

    await request(app.getHttpServer())
      .get('/admin/analytics/dashboard?month=2026-06')
      .expect(200)
      .expect((response) => {
        expect(response.body.data.period.month).toBe('2026-06');
        expect(response.body.data.cards[0]).toMatchObject({
          key: 'students',
          value: 12,
        });
      });
  });

  it('GET /analytics/instructor/dashboard returns instructor dashboard', async () => {
    getInstructorDashboardUseCase.execute.mockResolvedValue(
      instructorDashboard,
    );

    await request(app.getHttpServer())
      .get('/analytics/instructor/dashboard?month=2026-06')
      .set('x-user-id', 'instructor-1')
      .expect(200)
      .expect((response) => {
        expect(response.body.data.summary.totalStudents).toBe(30);
      });
  });
});
