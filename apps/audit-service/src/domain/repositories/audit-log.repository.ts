import { AuditEventEnvelope } from '@repo/common';

export interface AuditLogRecord extends AuditEventEnvelope {
  id: string;
  createdAt: Date;
}

export interface ListAuditLogsFilter {
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  serviceName?: string;
  from?: Date;
  to?: Date;
  page: number;
  size: number;
}

export interface ListAuditLogsPage {
  items: AuditLogRecord[];
  total: number;
}

export abstract class AuditLogRepository {
  abstract record(event: AuditEventEnvelope): Promise<void>;
  abstract findById(id: string): Promise<AuditLogRecord | null>;
  abstract list(filter: ListAuditLogsFilter): Promise<ListAuditLogsPage>;
}
