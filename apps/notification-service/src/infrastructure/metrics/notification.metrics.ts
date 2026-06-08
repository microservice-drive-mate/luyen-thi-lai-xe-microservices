import { Injectable } from '@nestjs/common';
import { MetricsService } from '@repo/common';

@Injectable()
export class NotificationMetrics {
  constructor(private readonly metricsService: MetricsService) {}

  recordConsumed(_eventType: string): void {
    // Message-level success/retry/DLQ metrics are recorded by RabbitMqRetryInterceptor.
  }

  recordSuccess(channel: string, eventType?: string): void {
    this.metricsService.recordNotificationDelivery({
      channel,
      event: eventType ?? 'unknown',
      status: 'success',
    });
  }

  recordFailure(channel: string, eventType?: string): void {
    this.metricsService.recordNotificationDelivery({
      channel,
      event: eventType ?? 'unknown',
      status: 'failure',
    });
  }

  recordSkipped(channel: string, eventType?: string): void {
    this.metricsService.recordNotificationDelivery({
      channel,
      event: eventType ?? 'unknown',
      status: 'skipped',
    });
  }

  setDlqDepth(_depth: number): void {
    // DLQ counters are recorded by the common RabbitMQ retry interceptor.
  }
}
