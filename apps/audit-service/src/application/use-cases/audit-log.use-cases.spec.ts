import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AuditEventEnvelope } from '@repo/common';
import {
  AuditLogRecord,
  AuditLogRepository,
} from '../../domain/repositories/audit-log.repository';
import { GetAuditLogUseCase } from './get-audit-log.use-case';
import { ListAuditLogsQuery } from './list-audit-logs.query';
import { ListAuditLogsUseCase } from './list-audit-logs.use-case';
import { RecordAuditLogUseCase } from './record-audit-log.use-case';

describe('Audit log use cases', () => {
  let repository: jest.Mocked<AuditLogRepository>;

  beforeEach(() => {
    repository = {
      record: jest.fn(),
      findById: jest.fn(),
      list: jest.fn(),
    };
  });

  it('records an audit event through the repository', async () => {
    const event = createAuditEvent();
    const useCase = new RecordAuditLogUseCase(repository);

    await useCase.execute(event);

    expect(repository.record).toHaveBeenCalledWith(event);
  });

  it('bounds list pagination before querying the repository', async () => {
    const record = createAuditRecord();
    repository.list.mockResolvedValue({ items: [record], total: 1 });
    const useCase = new ListAuditLogsUseCase(repository);

    const result = await useCase.execute(
      new ListAuditLogsQuery(
        0,
        500,
        'actor-1',
        'COURSE_ARCHIVED',
        'COURSE',
        'course-1',
        'course-service',
        new Date('2026-05-01T00:00:00.000Z'),
        new Date('2026-05-31T23:59:59.999Z'),
      ),
    );

    expect(repository.list).toHaveBeenCalledWith({
      page: 1,
      size: 100,
      actorId: 'actor-1',
      action: 'COURSE_ARCHIVED',
      resourceType: 'COURSE',
      resourceId: 'course-1',
      serviceName: 'course-service',
      from: new Date('2026-05-01T00:00:00.000Z'),
      to: new Date('2026-05-31T23:59:59.999Z'),
    });
    expect(result).toEqual({ items: [record], total: 1, page: 1, size: 100 });
  });

  it('returns an audit log by id', async () => {
    const record = createAuditRecord();
    repository.findById.mockResolvedValue(record);
    const useCase = new GetAuditLogUseCase(repository);

    await expect(useCase.execute(record.id)).resolves.toEqual(record);
    expect(repository.findById).toHaveBeenCalledWith(record.id);
  });

  it('throws AUDIT_LOG_NOT_FOUND when id does not exist', async () => {
    repository.findById.mockResolvedValue(null);
    const useCase = new GetAuditLogUseCase(repository);

    await useCase.execute('missing-id').catch((error: unknown) => {
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toEqual({
        code: 'AUDIT_LOG_NOT_FOUND',
        message: 'Audit log not found: missing-id',
      });
    });
  });
});

function createAuditEvent(): AuditEventEnvelope {
  return {
    eventId: 'event-1',
    eventName: 'security.audit.recorded',
    schemaVersion: 1,
    serviceName: 'course-service',
    actorId: 'actor-1',
    actorRole: 'ADMIN',
    action: 'COURSE_ARCHIVED',
    resourceType: 'COURSE',
    resourceId: 'course-1',
    outcome: 'SUCCESS',
    occurredAt: '2026-05-24T10:00:00.000Z',
    correlationId: 'correlation-1',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    requestPath: '/admin/courses/course-1',
    httpMethod: 'DELETE',
    metadata: { status: 'ARCHIVED' },
  };
}

function createAuditRecord(): AuditLogRecord {
  return {
    ...createAuditEvent(),
    id: 'audit-log-1',
    createdAt: new Date('2026-05-24T10:00:01.000Z'),
  };
}
