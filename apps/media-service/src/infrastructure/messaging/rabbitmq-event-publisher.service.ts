import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { DomainEvent } from '@repo/common';
import { lastValueFrom } from 'rxjs';
import { EventPublisher } from '../../application/ports/event-publisher.port';

export const RABBITMQ_CLIENT = 'RABBITMQ_CLIENT';
export const USER_SERVICE_CLIENT = 'USER_SERVICE_CLIENT';
export const COURSE_SERVICE_CLIENT = 'COURSE_SERVICE_CLIENT';

// Events that must be broadcast to subscriber services for eventual consistency
const BROADCAST_EVENTS = new Set(['media.file.deleted']);

@Injectable()
export class RabbitMqEventPublisher extends EventPublisher {
  private readonly logger = new Logger(RabbitMqEventPublisher.name);

  constructor(
    @Inject(RABBITMQ_CLIENT) private readonly client: ClientProxy,
    @Inject(USER_SERVICE_CLIENT)
    private readonly userServiceClient: ClientProxy,
    @Inject(COURSE_SERVICE_CLIENT)
    private readonly courseServiceClient: ClientProxy,
  ) {
    super();
  }

  async publish(event: DomainEvent): Promise<void> {
    try {
      await lastValueFrom(this.client.emit(event.eventName, event));
      this.logger.log(`Published event: ${event.eventName}`);

      if (BROADCAST_EVENTS.has(event.eventName)) {
        await Promise.all([
          lastValueFrom(this.userServiceClient.emit(event.eventName, event)),
          lastValueFrom(this.courseServiceClient.emit(event.eventName, event)),
        ]);
        this.logger.log(`Broadcast ${event.eventName} to subscriber services`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to publish event ${event.eventName}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
