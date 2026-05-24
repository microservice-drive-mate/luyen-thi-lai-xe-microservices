import { randomUUID } from 'node:crypto';
import { getCurrentCorrelationId } from '../http/correlation-context';
import { AuditEventEnvelope, CreateAuditEventInput } from './audit.types';

const SENSITIVE_KEY_PATTERN =
  /(authorization|password|token|secret|clientsecret|apikey|api_key|accesskey|accountkey)/i;

export function sanitizeAuditMetadata(
  metadata: Record<string, unknown> = {},
): Record<string, unknown> {
  return sanitizeObject(metadata) as Record<string, unknown>;
}

export function createAuditEvent(
  input: CreateAuditEventInput,
): AuditEventEnvelope {
  const context = input.requestContext;

  return {
    eventId: randomUUID(),
    eventName: 'security.audit.recorded',
    schemaVersion: 1,
    serviceName: input.serviceName,
    actorId: input.actorId,
    actorRole: input.actorRole ?? context?.actorRole,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    outcome: input.outcome ?? 'SUCCESS',
    occurredAt: new Date().toISOString(),
    correlationId: context?.correlationId ?? getCurrentCorrelationId(),
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
    requestPath: context?.requestPath,
    httpMethod: context?.httpMethod,
    metadata: sanitizeAuditMetadata(input.metadata),
  };
}

function sanitizeObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeObject(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    sanitized[key] = sanitizeObject(nestedValue);
  }

  return sanitized;
}
