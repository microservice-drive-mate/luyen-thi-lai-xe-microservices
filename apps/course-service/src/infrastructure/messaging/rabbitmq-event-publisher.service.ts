import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { DomainEvent } from '@repo/common';
import { lastValueFrom } from 'rxjs';
import { EventPublisher } from '../../application/ports/event-publisher.port';

export const RABBITMQ_CLIENT = 'RABBITMQ_CLIENT';

@Injectable()
export class RabbitMqEventPublisher extends EventPublisher {
  private readonly logger = new Logger(RabbitMqEventPublisher.name);

  constructor(@Inject(RABBITMQ_CLIENT) private readonly client: ClientProxy) {
    super();
  }

  async publish(event: DomainEvent): Promise<void> {
    try {
      await lastValueFrom(this.client.emit(event.eventName, event));
      this.logger.log(`Published event: ${event.eventName}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish event ${event.eventName}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
