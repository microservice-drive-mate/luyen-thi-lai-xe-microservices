import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const CORRELATION_ID_FIELD = 'correlationId';

interface CorrelationContext {
  correlationId: string;
}

const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

export function getCurrentCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}

export function runWithCorrelationId<T>(
  correlationId: string,
  callback: () => T,
): T {
  return correlationStorage.run({ correlationId }, callback);
}

export function createCorrelationId(): string {
  return randomUUID();
}

export function resolveHttpCorrelationId(request: Request): string | undefined {
  return getHeader(request, CORRELATION_ID_HEADER);
}

export function resolveMessageCorrelationId(
  payload: unknown,
  headers?: Record<string, unknown>,
): string | undefined {
  return (
    readString(headers?.[CORRELATION_ID_HEADER]) ??
    readString(headers?.[CORRELATION_ID_FIELD]) ??
    readStringFromRecord(payload, CORRELATION_ID_FIELD) ??
    readNestedStringFromRecord(payload, 'metadata', CORRELATION_ID_FIELD)
  );
}

export function withCorrelationId<T extends object>(
  payload: T,
  correlationId = getCurrentCorrelationId(),
): T & { correlationId?: string } {
  const existing = readStringFromRecord(payload, CORRELATION_ID_FIELD);
  if (existing || !correlationId) {
    return payload as T & { correlationId?: string };
  }

  return { ...payload, correlationId };
}

function getHeader(request: Request, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }

  return typeof value === 'string' ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readStringFromRecord(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return readString((value as Record<string, unknown>)[key]);
}

function readNestedStringFromRecord(
  value: unknown,
  parentKey: string,
  childKey: string,
): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return readStringFromRecord(
    (value as Record<string, unknown>)[parentKey],
    childKey,
  );
}
