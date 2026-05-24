import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import {
  AuditLogRecord,
  AuditLogRepository,
} from '../../domain/repositories/audit-log.repository';
import { ListAuditLogsQuery } from './list-audit-logs.query';

export interface ListAuditLogsResult {
  items: AuditLogRecord[];
  total: number;
  page: number;
  size: number;
}

@Injectable()
export class ListAuditLogsUseCase
  implements IUseCase<ListAuditLogsQuery, ListAuditLogsResult>
{
  constructor(private readonly repository: AuditLogRepository) {}

  async execute(query: ListAuditLogsQuery): Promise<ListAuditLogsResult> {
    const page = Math.max(query.page, 1);
    const size = Math.min(Math.max(query.size, 1), 100);
    const result = await this.repository.list({
      page,
      size,
      actorId: query.actorId,
      action: query.action,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      serviceName: query.serviceName,
      from: query.from,
      to: query.to,
    });

    return { ...result, page, size };
  }
}
