import { Injectable } from '@nestjs/common';
import { AuditEventEnvelope, IUseCase } from '@repo/common';
import { AuditLogRepository } from '../../domain/repositories/audit-log.repository';

@Injectable()
export class RecordAuditLogUseCase
  implements IUseCase<AuditEventEnvelope, void>
{
  constructor(private readonly repository: AuditLogRepository) {}

  async execute(event: AuditEventEnvelope): Promise<void> {
    await this.repository.record(event);
  }
}
