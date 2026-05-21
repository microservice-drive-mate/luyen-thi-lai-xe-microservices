import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { DomainEvent } from '@repo/common';
import { lastValueFrom } from 'rxjs';
import { EventPublisher } from '../../application/ports/event-publisher.port';

export const RABBITMQ_CLIENT = 'RABBITMQ_CLIENT';
export const MEDIA_SERVICE_CLIENT = 'MEDIA_SERVICE_CLIENT';

// Events routed exclusively to media-service for file ownership confirmation
const MEDIA_NOTIFY_EVENTS = new Set(['course.material.linked']);

@Injectable()
export class RabbitMqEventPublisher extends EventPublisher {
  private readonly logger = new Logger(RabbitMqEventPublisher.name);

  constructor(
    @Inject(RABBITMQ_CLIENT) private readonly client: ClientProxy,
    @Inject(MEDIA_SERVICE_CLIENT)
    private readonly mediaServiceClient: ClientProxy,
  ) {
    super();
  }

  async publish(event: DomainEvent): Promise<void> {
    try {
      if (MEDIA_NOTIFY_EVENTS.has(event.eventName)) {
        await lastValueFrom(
          this.mediaServiceClient.emit(event.eventName, event),
        );
        this.logger.log(`Routed ${event.eventName} → media-service`);
      } else {
        await lastValueFrom(this.client.emit(event.eventName, event));
        this.logger.log(`Published event: ${event.eventName}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to publish event ${event.eventName}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
