import { RecordAuditLogUseCase } from './record-audit-log.use-case';
import { AuditEventEnvelope } from '@repo/common';

describe('RecordAuditLogUseCase', () => {
  let useCase: RecordAuditLogUseCase;
  let repository: any;

  beforeEach(() => {
    repository = {
      record: jest.fn(),
    };
    useCase = new RecordAuditLogUseCase(repository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call repository.record with the event', async () => {
    const event: AuditEventEnvelope = {
      eventId: 'evt-1',
      eventName: 'security.audit.recorded',
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      serviceName: 'identity-service',
      actorId: 'user-1',
      action: 'USER_LOGIN_FAILED',
      resourceType: 'IdentityUser',
      resourceId: 'user-1',
      outcome: 'FAILURE',
      metadata: {},
    };

    await useCase.execute(event);
    expect(repository.record).toHaveBeenCalledWith(event);
  });
});
