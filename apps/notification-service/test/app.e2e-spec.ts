import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiResponseInterceptor } from '@repo/common';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { GetNotificationPreferencesUseCase } from '../src/application/use-cases/get-notification-preferences/get-notification-preferences.use-case';
import { ListNotificationsUseCase } from '../src/application/use-cases/list-notifications/list-notifications.use-case';
import { MarkAllNotificationsReadUseCase } from '../src/application/use-cases/mark-all-notifications-read/mark-all-notifications-read.use-case';
import { MarkNotificationReadUseCase } from '../src/application/use-cases/mark-notification-read/mark-notification-read.use-case';
import { QueueAcademicWarningsUseCase } from '../src/application/use-cases/queue-academic-warnings/queue-academic-warnings.use-case';
import { UpdateNotificationPreferencesUseCase } from '../src/application/use-cases/update-notification-preferences/update-notification-preferences.use-case';
import { NotificationController } from '../src/presentation/http/notification.controller';

describe('Notification service HTTP contract (e2e smoke)', () => {
  let app: INestApplication;

  const listNotificationsUseCase = { execute: jest.fn() };
  const markNotificationReadUseCase = { execute: jest.fn() };
  const markAllNotificationsReadUseCase = { execute: jest.fn() };
  const getNotificationPreferencesUseCase = { execute: jest.fn() };
  const updateNotificationPreferencesUseCase = { execute: jest.fn() };
  const queueAcademicWarningsUseCase = { execute: jest.fn() };

  const now = new Date('2026-06-01T00:00:00.000Z');
  const studentId = '550e8400-e29b-41d4-a716-446655440000';

  const notificationRecord = {
    id: 'notification-1',
    userId: studentId,
    type: 'IN_APP',
    eventType: 'identity.user.created',
    title: 'Chao mung',
    body: 'Tai khoan cua ban da duoc tao.',
    data: {},
    status: 'QUEUED',
    retryCount: 0,
    errorMessage: null,
    isRead: false,
    readAt: null,
    sentAt: null,
    deliveredAt: null,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: ListNotificationsUseCase,
          useValue: listNotificationsUseCase,
        },
        {
          provide: MarkNotificationReadUseCase,
          useValue: markNotificationReadUseCase,
        },
        {
          provide: MarkAllNotificationsReadUseCase,
          useValue: markAllNotificationsReadUseCase,
        },
        {
          provide: GetNotificationPreferencesUseCase,
          useValue: getNotificationPreferencesUseCase,
        },
        {
          provide: UpdateNotificationPreferencesUseCase,
          useValue: updateNotificationPreferencesUseCase,
        },
        {
          provide: QueueAcademicWarningsUseCase,
          useValue: queueAcademicWarningsUseCase,
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
        req.user = { sub: req.header('x-user-id') ?? studentId };
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

  it('GET /notifications/me lists current user notifications', async () => {
    listNotificationsUseCase.execute.mockResolvedValue({
      items: [notificationRecord],
      total: 1,
      page: 1,
      size: 20,
    });

    await request(app.getHttpServer())
      .get('/notifications/me')
      .set('x-user-id', studentId)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.items[0]).toMatchObject({
          id: 'notification-1',
          userId: studentId,
          isRead: false,
        });
      });
  });

  it('PATCH /notifications/:id/read marks one notification as read', async () => {
    markNotificationReadUseCase.execute.mockResolvedValue({
      ...notificationRecord,
      isRead: true,
      readAt: now,
    });

    await request(app.getHttpServer())
      .patch('/notifications/notification-1/read')
      .set('x-user-id', studentId)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.isRead).toBe(true);
      });
  });

  it('POST /admin/academic-warnings queues warning delivery', async () => {
    queueAcademicWarningsUseCase.execute.mockResolvedValue({
      accepted: 1,
      studentIds: [studentId],
    });

    await request(app.getHttpServer())
      .post('/admin/academic-warnings')
      .set('x-user-id', 'instructor-1')
      .send({
        studentIds: [studentId],
        deliveryChannels: ['IN_APP'],
        reason: 'LOW_PROGRESS',
        severity: 'HIGH',
        message: 'Hoc vien can bo sung tien do hoc tap.',
      })
      .expect(202)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          status: 'ACCEPTED',
          accepted: 1,
          studentIds: [studentId],
        });
      });
  });
});
