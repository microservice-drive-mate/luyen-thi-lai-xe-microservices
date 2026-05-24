import type { Request } from 'express';
import {
  CORRELATION_ID_HEADER,
  getCurrentCorrelationId,
} from '../http/correlation-context';
import { AuditRequestContext } from './audit.types';

export interface JwtLikeUser {
  sub?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
}

export function extractActorRole(user: JwtLikeUser | undefined): string {
  const realmRole = user?.realm_access?.roles?.[0];
  if (realmRole) {
    return realmRole;
  }

  const clientRoles = Object.values(user?.resource_access ?? {})
    .flatMap((access) => access.roles ?? [])
    .filter(Boolean);

  return clientRoles[0] ?? 'UNKNOWN';
}

export function buildAuditRequestContext(
  request: Request,
  user: JwtLikeUser | undefined,
): AuditRequestContext {
  const correlationId =
    getHeader(request, CORRELATION_ID_HEADER) ??
    (request as Request & { correlationId?: string }).correlationId ??
    getCurrentCorrelationId();

  return {
    correlationId,
    actorId: user?.sub ?? getHeader(request, 'x-user-id'),
    actorRole: extractActorRole(user),
    ipAddress:
      getHeader(request, 'x-forwarded-for')?.split(',')[0]?.trim() ??
      request.ip,
    userAgent: getHeader(request, 'user-agent'),
    requestPath: request.originalUrl ?? request.url,
    httpMethod: request.method,
  };
}

function getHeader(request: Request, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }

  return typeof value === 'string' ? value : undefined;
}
