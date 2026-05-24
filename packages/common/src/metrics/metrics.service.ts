import { Inject, Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';
import { METRICS_MODULE_OPTIONS } from './metrics.constants';

export interface MetricsModuleOptions {
  serviceName: string;
}

export interface HttpMetricInput {
  method: string;
  route: string;
  statusCode: number;
  durationSeconds: number;
}

@Injectable()
export class MetricsService {
  private static readonly registries = new Map<string, Registry>();
  private static readonly requestCounters = new Map<string, Counter<string>>();
  private static readonly requestDurationHistograms = new Map<
    string,
    Histogram<string>
  >();

  readonly registry: Registry;
  private readonly requestCounter: Counter<string>;
  private readonly requestDurationHistogram: Histogram<string>;

  constructor(@Inject(METRICS_MODULE_OPTIONS) options: MetricsModuleOptions) {
    const serviceName = sanitizeLabelValue(options.serviceName);
    this.registry = this.getOrCreateRegistry(serviceName);
    this.requestCounter = this.getOrCreateRequestCounter(serviceName);
    this.requestDurationHistogram =
      this.getOrCreateRequestDurationHistogram(serviceName);
  }

  recordHttpRequest(input: HttpMetricInput): void {
    const labels = {
      method: input.method,
      route: normalizeRoute(input.route),
      status_code: String(input.statusCode),
      status_class: `${Math.trunc(input.statusCode / 100)}xx`,
    };

    this.requestCounter.inc(labels);
    this.requestDurationHistogram.observe(labels, input.durationSeconds);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  private getOrCreateRegistry(serviceName: string): Registry {
    const existing = MetricsService.registries.get(serviceName);
    if (existing) {
      return existing;
    }

    const registry = new Registry();
    registry.setDefaultLabels({ service: serviceName });
    collectDefaultMetrics({
      prefix: 'nodejs_',
      register: registry,
    });

    MetricsService.registries.set(serviceName, registry);
    return registry;
  }

  private getOrCreateRequestCounter(serviceName: string): Counter<string> {
    const existing = MetricsService.requestCounters.get(serviceName);
    if (existing) {
      return existing;
    }

    const counter = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests handled by the service.',
      labelNames: ['method', 'route', 'status_code', 'status_class'],
      registers: [this.registry],
    });

    MetricsService.requestCounters.set(serviceName, counter);
    return counter;
  }

  private getOrCreateRequestDurationHistogram(
    serviceName: string,
  ): Histogram<string> {
    const existing = MetricsService.requestDurationHistograms.get(serviceName);
    if (existing) {
      return existing;
    }

    const histogram = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds.',
      labelNames: ['method', 'route', 'status_code', 'status_class'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    MetricsService.requestDurationHistograms.set(serviceName, histogram);
    return histogram;
  }
}

function normalizeRoute(route: string): string {
  const normalized = route.split('?')[0]?.trim() || '/';
  return normalized.length > 120
    ? `${normalized.slice(0, 117)}...`
    : normalized;
}

function sanitizeLabelValue(value: string): string {
  return value.trim() || 'unknown-service';
}
