export type AuditOutcome = 'SUCCESS' | 'FAILURE';

export interface AuditRequestContext {
  correlationId?: string;
  actorId?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
  requestPath?: string;
  httpMethod?: string;
}

export interface AuditEventEnvelope {
  eventId: string;
  eventName: 'security.audit.recorded';
  schemaVersion: 1;
  serviceName: string;
  actorId: string;
  actorRole?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: AuditOutcome;
  occurredAt: string;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestPath?: string;
  httpMethod?: string;
  metadata: Record<string, unknown>;
}

export interface CreateAuditEventInput {
  serviceName: string;
  actorId: string;
  actorRole?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome?: AuditOutcome;
  metadata?: Record<string, unknown>;
  requestContext?: AuditRequestContext;
}

export interface OutboxMessagePayload {
  eventName: string;
  payload: Record<string, unknown>;
}
