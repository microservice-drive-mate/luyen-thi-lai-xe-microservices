import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { DomainEvent, withCorrelationId } from '@repo/common';
import { lastValueFrom } from 'rxjs';
import { EventPublisher } from '../../application/ports/event-publisher.port';

export const RABBITMQ_CLIENT = 'RABBITMQ_CLIENT';
export const ANALYTICS_SERVICE_CLIENT = 'ANALYTICS_SERVICE_CLIENT';
export const NOTIFICATION_SERVICE_CLIENT = 'NOTIFICATION_SERVICE_CLIENT';

const ANALYTICS_EVENTS = new Set(['exam.session.completed']);
const NOTIFICATION_EVENTS = new Set([
  'exam.session.passed',
  'exam.session.failed',
]);

@Injectable()
export class RabbitMqEventPublisher extends EventPublisher {
  private readonly logger = new Logger(RabbitMqEventPublisher.name);

  constructor(
    @Inject(RABBITMQ_CLIENT) private readonly client: ClientProxy,
    @Inject(ANALYTICS_SERVICE_CLIENT)
    private readonly analyticsClient: ClientProxy,
    @Inject(NOTIFICATION_SERVICE_CLIENT)
    private readonly notificationClient: ClientProxy,
  ) {
    super();
  }

  async publish(event: DomainEvent): Promise<void> {
    const payload = withCorrelationId(event);

    try {
      if (ANALYTICS_EVENTS.has(event.eventName)) {
        await lastValueFrom(
          this.analyticsClient.emit(event.eventName, payload),
        );
      } else if (NOTIFICATION_EVENTS.has(event.eventName)) {
        await lastValueFrom(
          this.notificationClient.emit(event.eventName, payload),
        );
      } else {
        await lastValueFrom(this.client.emit(event.eventName, payload));
      }
      this.logger.log(`Published event: ${event.eventName}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish event ${event.eventName}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
