import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiResponseInterceptor } from '@repo/common';
import request from 'supertest';
import { GetAuditLogUseCase } from '../src/application/use-cases/get-audit-log.use-case';
import { ListAuditLogsUseCase } from '../src/application/use-cases/list-audit-logs.use-case';
import { AuditLogController } from '../src/presentation/http/audit-log.controller';

describe('Audit service HTTP contract (e2e smoke)', () => {
  let app: INestApplication;

  const listAuditLogsUseCase = { execute: jest.fn() };
  const getAuditLogUseCase = { execute: jest.fn() };

  const auditLog = {
    id: 'audit-1',
    eventId: 'event-1',
    serviceName: 'identity-service',
    actorId: 'admin-1',
    actorRole: 'ADMIN',
    action: 'identity.user.created',
    resourceType: 'identity-user',
    resourceId: 'user-1',
    outcome: 'SUCCESS',
    occurredAt: '2026-06-01T00:00:00.000Z',
    correlationId: 'correlation-1',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    requestPath: '/admin/identity-users',
    httpMethod: 'POST',
    metadata: { email: 'student@test.com' },
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [
        { provide: ListAuditLogsUseCase, useValue: listAuditLogsUseCase },
        { provide: GetAuditLogUseCase, useValue: getAuditLogUseCase },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /admin/audit-logs returns paginated immutable audit records', async () => {
    listAuditLogsUseCase.execute.mockResolvedValue({
      items: [auditLog],
      total: 1,
      page: 1,
      size: 20,
    });

    await request(app.getHttpServer())
      .get('/admin/audit-logs?serviceName=identity-service')
      .expect(200)
      .expect((response) => {
        expect(response.body.data.total).toBe(1);
        expect(response.body.data.items[0]).toMatchObject({
          id: 'audit-1',
          serviceName: 'identity-service',
          action: 'identity.user.created',
          outcome: 'SUCCESS',
        });
      });
  });

  it('GET /admin/audit-logs/:id returns one audit log detail', async () => {
    getAuditLogUseCase.execute.mockResolvedValue(auditLog);

    await request(app.getHttpServer())
      .get('/admin/audit-logs/audit-1')
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          id: 'audit-1',
          resourceId: 'user-1',
          metadata: { email: 'student@test.com' },
        });
      });
  });
});
