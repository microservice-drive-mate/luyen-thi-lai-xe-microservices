import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const CORRELATION_ID_FIELD = 'correlationId';

export const K6_TRACE_ID_HEADER = 'x-k6-trace-id';
export const K6_SCENARIO_HEADER = 'x-k6-scenario';

interface CorrelationContext {
  correlationId: string;
  k6TraceId?: string;
  k6Scenario?: string;
}

const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

export function getCurrentCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}

export function getCurrentK6TraceId(): string | undefined {
  return correlationStorage.getStore()?.k6TraceId;
}

export function getCurrentK6Scenario(): string | undefined {
  return correlationStorage.getStore()?.k6Scenario;
}

export function isK6Request(): boolean {
  return !!correlationStorage.getStore()?.k6TraceId;
}

export function runWithCorrelationId<T>(
  correlationId: string,
  callback: () => T,
  k6Context?: { k6TraceId?: string; k6Scenario?: string },
): T {
  return correlationStorage.run({ correlationId, ...k6Context }, callback);
}

export function createCorrelationId(): string {
  return randomUUID();
}

export function resolveHttpCorrelationId(request: Request): string | undefined {
  return getHeader(request, CORRELATION_ID_HEADER);
}

export function resolveK6Context(request: Request): {
  k6TraceId?: string;
  k6Scenario?: string;
} {
  return {
    k6TraceId: getHeader(request, K6_TRACE_ID_HEADER),
    k6Scenario: getHeader(request, K6_SCENARIO_HEADER),
  };
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
