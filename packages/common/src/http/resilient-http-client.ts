import type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { context, propagation, type TextMapSetter } from '@opentelemetry/api';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  openMs?: number;
}

export interface HttpResilienceOptions {
  dependencyName: string;
  serviceName?: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  retryBackoffFactor?: number;
  circuitBreaker?: CircuitBreakerOptions;
}

interface CircuitState {
  failures: number;
  openedUntil: number;
}

type RetryableAxiosConfig = InternalAxiosRequestConfig & {
  __resilienceRetryCount?: number;
};

const DEFAULT_TIMEOUT_MS = 3_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 200;
const DEFAULT_BACKOFF_FACTOR = 2;
const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_OPEN_MS = 30_000;
const circuits = new Map<string, CircuitState>();
const configuredAxiosInstances = new WeakSet<AxiosInstance>();

export class CircuitBreakerOpenError extends Error {
  constructor(dependencyName: string) {
    super(`Circuit breaker is open for ${dependencyName}`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export async function resilientFetch(
  input: string | URL | Request,
  init: RequestInit = {},
  options: HttpResilienceOptions,
): Promise<Response> {
  const normalized = normalizeOptions(options);
  assertCircuitClosed(normalized);
  const headers = injectTraceContext(init.headers);

  for (let attempt = 0; attempt <= normalized.retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), normalized.timeoutMs);
    const upstreamSignal = init.signal;
    const abortFromUpstream = () => controller.abort();
    upstreamSignal?.addEventListener('abort', abortFromUpstream, {
      once: true,
    });

    try {
      const response = await fetch(input, {
        ...init,
        headers,
        signal: controller.signal,
      });

      if (
        !shouldRetryStatus(response.status) ||
        attempt === normalized.retries
      ) {
        recordCircuitResult(normalized, response.ok || response.status < 500);
        return response;
      }
    } catch (error) {
      if (attempt === normalized.retries) {
        recordCircuitResult(normalized, false);
        throw error;
      }
    } finally {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    }

    await sleep(backoffMs(normalized, attempt));
    assertCircuitClosed(normalized);
  }

  throw new Error(`HTTP request failed for ${normalized.dependencyName}`);
}

export function configureAxiosResilience(
  axiosInstance: AxiosInstance,
  options: HttpResilienceOptions,
): void {
  if (configuredAxiosInstances.has(axiosInstance)) {
    return;
  }

  const normalized = normalizeOptions(options);
  configuredAxiosInstances.add(axiosInstance);
  axiosInstance.defaults.timeout = normalized.timeoutMs;

  axiosInstance.interceptors.request.use((config) => {
    assertCircuitClosed(normalized);
    config.timeout = config.timeout ?? normalized.timeoutMs;
    propagation.inject(context.active(), config.headers, traceHeaderSetter);
    return config;
  });

  axiosInstance.interceptors.response.use(
    (response) => {
      recordCircuitResult(normalized, response.status < 500);
      return response;
    },
    async (error: AxiosError) => {
      const config = error.config as RetryableAxiosConfig | undefined;
      const status = error.response?.status;
      const retryCount = config?.__resilienceRetryCount ?? 0;

      if (
        !config ||
        retryCount >= normalized.retries ||
        !isRetryableAxiosError(error)
      ) {
        recordCircuitResult(normalized, status ? status < 500 : false);
        throw error;
      }

      config.__resilienceRetryCount = retryCount + 1;
      await sleep(backoffMs(normalized, retryCount));
      assertCircuitClosed(normalized);

      return axiosInstance.request(
        config as AxiosRequestConfig,
      ) as Promise<AxiosResponse>;
    },
  );
}

function normalizeOptions(options: HttpResilienceOptions): Required<
  Omit<HttpResilienceOptions, 'circuitBreaker'>
> & {
  circuitBreaker: Required<CircuitBreakerOptions>;
} {
  return {
    dependencyName: options.dependencyName,
    serviceName: options.serviceName ?? 'unknown-service',
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    retries: options.retries ?? DEFAULT_RETRIES,
    retryDelayMs: options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
    retryBackoffFactor: options.retryBackoffFactor ?? DEFAULT_BACKOFF_FACTOR,
    circuitBreaker: {
      failureThreshold:
        options.circuitBreaker?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD,
      openMs: options.circuitBreaker?.openMs ?? DEFAULT_OPEN_MS,
    },
  };
}

function circuitKey(options: { serviceName: string; dependencyName: string }) {
  return `${options.serviceName}:${options.dependencyName}`;
}

function assertCircuitClosed(
  options: ReturnType<typeof normalizeOptions>,
): void {
  const state = circuits.get(circuitKey(options));
  if (!state || state.openedUntil <= Date.now()) {
    return;
  }

  throw new CircuitBreakerOpenError(options.dependencyName);
}

function recordCircuitResult(
  options: ReturnType<typeof normalizeOptions>,
  success: boolean,
): void {
  const key = circuitKey(options);
  if (success) {
    circuits.delete(key);
    return;
  }

  const current = circuits.get(key) ?? { failures: 0, openedUntil: 0 };
  const failures = current.failures + 1;
  circuits.set(key, {
    failures,
    openedUntil:
      failures >= options.circuitBreaker.failureThreshold
        ? Date.now() + options.circuitBreaker.openMs
        : current.openedUntil,
  });
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableAxiosError(error: AxiosError): boolean {
  const status = error.response?.status;
  return !status || shouldRetryStatus(status);
}

function backoffMs(
  options: ReturnType<typeof normalizeOptions>,
  attempt: number,
): number {
  return Math.round(
    options.retryDelayMs * options.retryBackoffFactor ** attempt,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const traceHeaderSetter: TextMapSetter<
  Headers | Record<string, unknown> | undefined
> = {
  set(carrier, key, value) {
    if (!carrier) {
      return;
    }

    if (carrier instanceof Headers) {
      carrier.set(key, value);
      return;
    }

    carrier[key] = value;
  },
};

function injectTraceContext(headers: RequestInit['headers']): Headers {
  const carrier = new Headers(headers);
  propagation.inject(context.active(), carrier, traceHeaderSetter);
  return carrier;
}
