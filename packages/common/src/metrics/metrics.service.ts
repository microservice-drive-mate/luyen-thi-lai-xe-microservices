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

export interface RabbitMqRetryMetricInput {
  queue: string;
  targetQueue: string;
  retryCount: number;
}

export interface UserCreatedBusinessMetricInput {
  role: string;
  source?: string;
}

export interface ExamSessionStartedBusinessMetricInput {
  licenseCategory: string;
}

export interface ExamSessionCompletedBusinessMetricInput {
  licenseCategory: string;
  status: string;
  result: 'pass' | 'fail' | 'unknown';
  failedByCritical?: boolean;
}

export interface CourseLessonCompletedBusinessMetricInput {
  courseId: string;
  enrollmentStatus: string;
}

export interface CourseEnrollmentCompletedBusinessMetricInput {
  courseId: string;
}

export interface NotificationDeliveryBusinessMetricInput {
  channel: string;
  event: string;
  status: 'success' | 'failure' | 'skipped';
}

export interface MediaUploadBusinessMetricInput {
  mode: 'direct' | 'presigned';
  mimeType: string;
  status: 'success' | 'failure';
}

@Injectable()
export class MetricsService {
  private static readonly registries = new Map<string, Registry>();
  private static readonly requestCounters = new Map<string, Counter<string>>();
  private static readonly requestDurationHistograms = new Map<
    string,
    Histogram<string>
  >();
  private static readonly rabbitMqMessageCounters = new Map<
    string,
    Counter<string>
  >();
  private static readonly rabbitMqRetryCounters = new Map<
    string,
    Counter<string>
  >();
  private static readonly rabbitMqDeadLetterCounters = new Map<
    string,
    Counter<string>
  >();
  private static readonly usersCreatedCounters = new Map<
    string,
    Counter<string>
  >();
  private static readonly examSessionsStartedCounters = new Map<
    string,
    Counter<string>
  >();
  private static readonly examSessionsCompletedCounters = new Map<
    string,
    Counter<string>
  >();
  private static readonly courseLessonsCompletedCounters = new Map<
    string,
    Counter<string>
  >();
  private static readonly courseEnrollmentsCompletedCounters = new Map<
    string,
    Counter<string>
  >();
  private static readonly notificationDeliveryCounters = new Map<
    string,
    Counter<string>
  >();
  private static readonly mediaUploadCounters = new Map<
    string,
    Counter<string>
  >();

  readonly registry: Registry;
  private readonly requestCounter: Counter<string>;
  private readonly requestDurationHistogram: Histogram<string>;
  private readonly rabbitMqMessageCounter: Counter<string>;
  private readonly rabbitMqRetryCounter: Counter<string>;
  private readonly rabbitMqDeadLetterCounter: Counter<string>;
  private readonly usersCreatedCounter: Counter<string>;
  private readonly examSessionsStartedCounter: Counter<string>;
  private readonly examSessionsCompletedCounter: Counter<string>;
  private readonly courseLessonsCompletedCounter: Counter<string>;
  private readonly courseEnrollmentsCompletedCounter: Counter<string>;
  private readonly notificationDeliveryCounter: Counter<string>;
  private readonly mediaUploadCounter: Counter<string>;

  constructor(@Inject(METRICS_MODULE_OPTIONS) options: MetricsModuleOptions) {
    const serviceName = sanitizeLabelValue(options.serviceName);
    this.registry = this.getOrCreateRegistry(serviceName);
    this.requestCounter = this.getOrCreateRequestCounter(serviceName);
    this.requestDurationHistogram =
      this.getOrCreateRequestDurationHistogram(serviceName);
    this.rabbitMqMessageCounter =
      this.getOrCreateRabbitMqMessageCounter(serviceName);
    this.rabbitMqRetryCounter =
      this.getOrCreateRabbitMqRetryCounter(serviceName);
    this.rabbitMqDeadLetterCounter =
      this.getOrCreateRabbitMqDeadLetterCounter(serviceName);
    this.usersCreatedCounter = this.getOrCreateUsersCreatedCounter(serviceName);
    this.examSessionsStartedCounter =
      this.getOrCreateExamSessionsStartedCounter(serviceName);
    this.examSessionsCompletedCounter =
      this.getOrCreateExamSessionsCompletedCounter(serviceName);
    this.courseLessonsCompletedCounter =
      this.getOrCreateCourseLessonsCompletedCounter(serviceName);
    this.courseEnrollmentsCompletedCounter =
      this.getOrCreateCourseEnrollmentsCompletedCounter(serviceName);
    this.notificationDeliveryCounter =
      this.getOrCreateNotificationDeliveryCounter(serviceName);
    this.mediaUploadCounter = this.getOrCreateMediaUploadCounter(serviceName);
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

  recordRabbitMqMessage(queue: string, outcome: 'success' | 'retry' | 'dlq') {
    this.rabbitMqMessageCounter.inc({ queue, outcome });
  }

  recordRabbitMqRetry(input: RabbitMqRetryMetricInput): void {
    this.rabbitMqRetryCounter.inc({
      queue: input.queue,
      retry_queue: input.targetQueue,
      retry_count: String(input.retryCount),
    });
  }

  recordRabbitMqDeadLetter(input: RabbitMqRetryMetricInput): void {
    this.rabbitMqDeadLetterCounter.inc({
      queue: input.queue,
      dlq: input.targetQueue,
      retry_count: String(input.retryCount),
    });
  }

  recordUserCreated(input: UserCreatedBusinessMetricInput): void {
    this.usersCreatedCounter.inc({
      role: normalizeLabel(input.role),
      source: normalizeLabel(input.source ?? 'unknown'),
    });
  }

  recordExamSessionStarted(input: ExamSessionStartedBusinessMetricInput): void {
    this.examSessionsStartedCounter.inc({
      license_category: normalizeLabel(input.licenseCategory),
    });
  }

  recordExamSessionCompleted(
    input: ExamSessionCompletedBusinessMetricInput,
  ): void {
    this.examSessionsCompletedCounter.inc({
      license_category: normalizeLabel(input.licenseCategory),
      status: normalizeLabel(input.status),
      result: normalizeLabel(input.result),
      failed_by_critical: String(Boolean(input.failedByCritical)),
    });
  }

  recordCourseLessonCompleted(
    input: CourseLessonCompletedBusinessMetricInput,
  ): void {
    this.courseLessonsCompletedCounter.inc({
      course_id: normalizeLabel(input.courseId),
      enrollment_status: normalizeLabel(input.enrollmentStatus),
    });
  }

  recordCourseEnrollmentCompleted(
    input: CourseEnrollmentCompletedBusinessMetricInput,
  ): void {
    this.courseEnrollmentsCompletedCounter.inc({
      course_id: normalizeLabel(input.courseId),
    });
  }

  recordNotificationDelivery(
    input: NotificationDeliveryBusinessMetricInput,
  ): void {
    this.notificationDeliveryCounter.inc({
      channel: normalizeLabel(input.channel),
      event: normalizeLabel(input.event),
      status: normalizeLabel(input.status),
    });
  }

  recordMediaUpload(input: MediaUploadBusinessMetricInput): void {
    this.mediaUploadCounter.inc({
      mode: normalizeLabel(input.mode),
      mime_type: normalizeMimeType(input.mimeType),
      status: normalizeLabel(input.status),
    });
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

  private getOrCreateRabbitMqMessageCounter(
    serviceName: string,
  ): Counter<string> {
    const existing = MetricsService.rabbitMqMessageCounters.get(serviceName);
    if (existing) {
      return existing;
    }

    const counter = new Counter({
      name: 'rabbitmq_messages_processed_total',
      help: 'Total number of RabbitMQ messages handled by the service.',
      labelNames: ['queue', 'outcome'],
      registers: [this.registry],
    });

    MetricsService.rabbitMqMessageCounters.set(serviceName, counter);
    return counter;
  }

  private getOrCreateRabbitMqRetryCounter(
    serviceName: string,
  ): Counter<string> {
    const existing = MetricsService.rabbitMqRetryCounters.get(serviceName);
    if (existing) {
      return existing;
    }

    const counter = new Counter({
      name: 'rabbitmq_message_retries_total',
      help: 'Total number of RabbitMQ messages scheduled for retry.',
      labelNames: ['queue', 'retry_queue', 'retry_count'],
      registers: [this.registry],
    });

    MetricsService.rabbitMqRetryCounters.set(serviceName, counter);
    return counter;
  }

  private getOrCreateRabbitMqDeadLetterCounter(
    serviceName: string,
  ): Counter<string> {
    const existing = MetricsService.rabbitMqDeadLetterCounters.get(serviceName);
    if (existing) {
      return existing;
    }

    const counter = new Counter({
      name: 'rabbitmq_messages_dead_lettered_total',
      help: 'Total number of RabbitMQ messages routed to a dead letter queue.',
      labelNames: ['queue', 'dlq', 'retry_count'],
      registers: [this.registry],
    });

    MetricsService.rabbitMqDeadLetterCounters.set(serviceName, counter);
    return counter;
  }

  private getOrCreateUsersCreatedCounter(serviceName: string): Counter<string> {
    const existing = MetricsService.usersCreatedCounters.get(serviceName);
    if (existing) {
      return existing;
    }

    const counter = new Counter({
      name: 'users_created_total',
      help: 'Total number of user profiles created by role and source.',
      labelNames: ['role', 'source'],
      registers: [this.registry],
    });

    MetricsService.usersCreatedCounters.set(serviceName, counter);
    return counter;
  }

  private getOrCreateExamSessionsStartedCounter(
    serviceName: string,
  ): Counter<string> {
    const existing =
      MetricsService.examSessionsStartedCounters.get(serviceName);
    if (existing) {
      return existing;
    }

    const counter = new Counter({
      name: 'exam_sessions_started_total',
      help: 'Total number of exam sessions started by license category.',
      labelNames: ['license_category'],
      registers: [this.registry],
    });

    MetricsService.examSessionsStartedCounters.set(serviceName, counter);
    return counter;
  }

  private getOrCreateExamSessionsCompletedCounter(
    serviceName: string,
  ): Counter<string> {
    const existing =
      MetricsService.examSessionsCompletedCounters.get(serviceName);
    if (existing) {
      return existing;
    }

    const counter = new Counter({
      name: 'exam_sessions_completed_total',
      help: 'Total number of exam sessions completed by result.',
      labelNames: [
        'license_category',
        'status',
        'result',
        'failed_by_critical',
      ],
      registers: [this.registry],
    });

    MetricsService.examSessionsCompletedCounters.set(serviceName, counter);
    return counter;
  }

  private getOrCreateCourseLessonsCompletedCounter(
    serviceName: string,
  ): Counter<string> {
    const existing =
      MetricsService.courseLessonsCompletedCounters.get(serviceName);
    if (existing) {
      return existing;
    }

    const counter = new Counter({
      name: 'course_lessons_completed_total',
      help: 'Total number of course lessons completed by course and enrollment status.',
      labelNames: ['course_id', 'enrollment_status'],
      registers: [this.registry],
    });

    MetricsService.courseLessonsCompletedCounters.set(serviceName, counter);
    return counter;
  }

  private getOrCreateCourseEnrollmentsCompletedCounter(
    serviceName: string,
  ): Counter<string> {
    const existing =
      MetricsService.courseEnrollmentsCompletedCounters.get(serviceName);
    if (existing) {
      return existing;
    }

    const counter = new Counter({
      name: 'course_enrollments_completed_total',
      help: 'Total number of course enrollments completed by course.',
      labelNames: ['course_id'],
      registers: [this.registry],
    });

    MetricsService.courseEnrollmentsCompletedCounters.set(serviceName, counter);
    return counter;
  }

  private getOrCreateNotificationDeliveryCounter(
    serviceName: string,
  ): Counter<string> {
    const existing =
      MetricsService.notificationDeliveryCounters.get(serviceName);
    if (existing) {
      return existing;
    }

    const counter = new Counter({
      name: 'notifications_delivery_total',
      help: 'Total number of notification delivery attempts by channel, event and status.',
      labelNames: ['channel', 'event', 'status'],
      registers: [this.registry],
    });

    MetricsService.notificationDeliveryCounters.set(serviceName, counter);
    return counter;
  }

  private getOrCreateMediaUploadCounter(serviceName: string): Counter<string> {
    const existing = MetricsService.mediaUploadCounters.get(serviceName);
    if (existing) {
      return existing;
    }

    const counter = new Counter({
      name: 'media_upload_total',
      help: 'Total number of media upload operations by mode, MIME type and status.',
      labelNames: ['mode', 'mime_type', 'status'],
      registers: [this.registry],
    });

    MetricsService.mediaUploadCounters.set(serviceName, counter);
    return counter;
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

function normalizeLabel(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_');
  return normalized.slice(0, 80) || 'unknown';
}

function normalizeMimeType(value: string): string {
  const [type, subtype] = value.toLowerCase().split('/');
  if (!type || !subtype) {
    return 'unknown';
  }

  return `${normalizeLabel(type)}/${normalizeLabel(subtype)}`;
}
