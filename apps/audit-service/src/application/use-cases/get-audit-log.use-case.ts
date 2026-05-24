import { Injectable, NotFoundException } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import {
  AuditLogRecord,
  AuditLogRepository,
} from '../../domain/repositories/audit-log.repository';

@Injectable()
export class GetAuditLogUseCase implements IUseCase<string, AuditLogRecord> {
  constructor(private readonly repository: AuditLogRepository) {}

  async execute(id: string): Promise<AuditLogRecord> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new NotFoundException({
        code: 'AUDIT_LOG_NOT_FOUND',
        message: `Audit log not found: ${id}`,
      });
    }

    return record;
  }
}
