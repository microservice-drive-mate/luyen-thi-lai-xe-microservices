import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { DomainEvent, withCorrelationId } from '@repo/common';
import { lastValueFrom } from 'rxjs';
import { IdentityEventPublisherPort } from '../../application/ports/identity-event-publisher.port';

export const USER_SERVICE_CLIENT = 'USER_SERVICE_CLIENT';
export const NOTI_SERVICE_CLIENT = 'NOTI_SERVICE';
export const ANALYTICS_SERVICE_CLIENT = 'ANALYTICS_SERVICE_CLIENT';

const USER_AND_NOTI_EVENTS = new Set([
  'identity.user.created',
  'identity.user.locked',
]);

const USER_ONLY_EVENTS = new Set([
  'identity.user.role-changed',
  'identity.user.updated',
  'identity.user.deleted',
]);

@Injectable()
export class IdentityEventPublisher extends IdentityEventPublisherPort {
  private readonly logger = new Logger(IdentityEventPublisher.name);

  constructor(
    @Inject(USER_SERVICE_CLIENT)
    private readonly userServiceClient: ClientProxy,
    @Inject(NOTI_SERVICE_CLIENT)
    private readonly notiServiceClient: ClientProxy,
    @Inject(ANALYTICS_SERVICE_CLIENT)
    private readonly analyticsServiceClient: ClientProxy,
  ) {
    super();
  }

  async publish(event: DomainEvent): Promise<void> {
    const payload = withCorrelationId(event);

    try {
      if (USER_AND_NOTI_EVENTS.has(event.eventName)) {
        await Promise.all([
          lastValueFrom(this.userServiceClient.emit(event.eventName, payload)),
          lastValueFrom(this.notiServiceClient.emit(event.eventName, payload)),
          lastValueFrom(
            this.analyticsServiceClient.emit(event.eventName, payload),
          ),
        ]);
      } else if (USER_ONLY_EVENTS.has(event.eventName)) {
        await Promise.all([
          lastValueFrom(this.userServiceClient.emit(event.eventName, payload)),
          lastValueFrom(
            this.analyticsServiceClient.emit(event.eventName, payload),
          ),
        ]);
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
