import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;
let shutdownRegistered = false;

export type OpenTelemetryOptions = {
  serviceName: string;
  serviceVersion?: string;
};

export function startOpenTelemetry(options: OpenTelemetryOptions): void {
  if (sdk || !isOpenTelemetryEnabled()) {
    return;
  }

  const endpoint = resolveOtlpTracesEndpoint();
  process.env.OTEL_SERVICE_NAME ??= options.serviceName;
  process.env.OTEL_PROPAGATORS ??= 'tracecontext,baggage';

  if (process.env.OTEL_LOG_LEVEL === 'debug') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.serviceName,
      [ATTR_SERVICE_VERSION]: options.serviceVersion ?? 'development',
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    }),
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (request) => {
          const url = request.url ?? '';
          return url.startsWith('/health') || url.startsWith('/metrics');
        },
      }),
      new ExpressInstrumentation(),
      new NestInstrumentation(),
    ],
  });

  sdk.start();
  registerShutdown();

  console.log(
    `[opentelemetry] tracing enabled for ${options.serviceName}, exporting to ${endpoint}`,
  );
}

export function isOpenTelemetryEnabled(): boolean {
  const explicit = process.env.OTEL_TRACING_ENABLED?.toLowerCase();

  if (explicit === 'false' || explicit === '0') {
    return false;
  }

  return (
    explicit === 'true' ||
    explicit === '1' ||
    Boolean(process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) ||
    Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT)
  );
}

export function resolveOtlpTracesEndpoint(): string {
  if (process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) {
    return process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  }

  const baseEndpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

  if (baseEndpoint.endsWith('/v1/traces')) {
    return baseEndpoint;
  }

  return `${baseEndpoint.replace(/\/$/, '')}/v1/traces`;
}

function registerShutdown(): void {
  if (shutdownRegistered) {
    return;
  }

  shutdownRegistered = true;
  const shutdown = async () => {
    try {
      await sdk?.shutdown();
      console.log('[opentelemetry] tracing shutdown complete');
    } catch (error) {
      console.error('[opentelemetry] tracing shutdown failed', error);
    }
  };

  process.once('SIGTERM', () => void shutdown());
  process.once('SIGINT', () => void shutdown());
}
