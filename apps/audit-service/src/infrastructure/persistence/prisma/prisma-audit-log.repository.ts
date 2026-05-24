import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/audit-client';
import {
  AuditLogRecord,
  AuditLogRepository,
  ListAuditLogsFilter,
  ListAuditLogsPage,
} from '../../../domain/repositories/audit-log.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaAuditLogRepository extends AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async record(event: AuditLogRecord): Promise<void>;
  async record(
    event: Parameters<AuditLogRepository['record']>[0],
  ): Promise<void> {
    await this.prisma.auditLog.upsert({
      where: { eventId: event.eventId },
      create: {
        eventId: event.eventId,
        schemaVersion: event.schemaVersion,
        serviceName: event.serviceName,
        actorId: event.actorId,
        actorRole: event.actorRole,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        outcome: event.outcome,
        occurredAt: new Date(event.occurredAt),
        correlationId: event.correlationId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        requestPath: event.requestPath,
        httpMethod: event.httpMethod,
        metadata: event.metadata as Prisma.InputJsonValue,
      },
      update: {},
    });
  }

  async findById(id: string): Promise<AuditLogRecord | null> {
    const raw = await this.prisma.auditLog.findUnique({ where: { id } });
    return raw ? toRecord(raw) : null;
  }

  async list(filter: ListAuditLogsFilter): Promise<ListAuditLogsPage> {
    const where: Prisma.AuditLogWhereInput = {
      ...(filter.actorId && { actorId: filter.actorId }),
      ...(filter.action && { action: filter.action }),
      ...(filter.resourceType && { resourceType: filter.resourceType }),
      ...(filter.resourceId && { resourceId: filter.resourceId }),
      ...(filter.serviceName && { serviceName: filter.serviceName }),
      ...((filter.from || filter.to) && {
        occurredAt: {
          ...(filter.from && { gte: filter.from }),
          ...(filter.to && { lte: filter.to }),
        },
      }),
    };
    const skip = (filter.page - 1) * filter.size;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: filter.size,
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items: items.map(toRecord), total };
  }
}

type RawAuditLog = Awaited<
  ReturnType<PrismaService['auditLog']['findUnique']>
> & {};

function toRecord(raw: NonNullable<RawAuditLog>): AuditLogRecord {
  return {
    id: raw.id,
    eventId: raw.eventId,
    eventName: 'security.audit.recorded',
    schemaVersion: 1,
    serviceName: raw.serviceName,
    actorId: raw.actorId,
    actorRole: raw.actorRole ?? undefined,
    action: raw.action,
    resourceType: raw.resourceType,
    resourceId: raw.resourceId,
    outcome: raw.outcome as 'SUCCESS' | 'FAILURE',
    occurredAt: raw.occurredAt.toISOString(),
    correlationId: raw.correlationId ?? undefined,
    ipAddress: raw.ipAddress ?? undefined,
    userAgent: raw.userAgent ?? undefined,
    requestPath: raw.requestPath ?? undefined,
    httpMethod: raw.httpMethod ?? undefined,
    metadata: raw.metadata as Record<string, unknown>,
    createdAt: raw.createdAt,
  };
}
