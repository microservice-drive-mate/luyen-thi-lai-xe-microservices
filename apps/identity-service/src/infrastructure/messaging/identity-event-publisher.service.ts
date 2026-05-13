import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { DomainEvent } from '@repo/common';
import { lastValueFrom } from 'rxjs';

export const USER_SERVICE_CLIENT = 'USER_SERVICE_CLIENT';
export const NOTI_SERVICE_CLIENT = 'NOTI_SERVICE';

// Events cần notify cả user-service lẫn notification-service
const USER_AND_NOTI_EVENTS = new Set(['identity.user.created']);
// Events chỉ notify user-service
const USER_ONLY_EVENTS = new Set(['identity.user.role-changed']);
// Events chỉ notify notification-service
const NOTI_ONLY_EVENTS = new Set(['identity.user.locked']);

@Injectable()
export class IdentityEventPublisher {
  private readonly logger = new Logger(IdentityEventPublisher.name);

  constructor(
    @Inject(USER_SERVICE_CLIENT)
    private readonly userServiceClient: ClientProxy,
    @Inject(NOTI_SERVICE_CLIENT)
    private readonly notiServiceClient: ClientProxy,
  ) {}

  async publish(event: DomainEvent): Promise<void> {
    try {
      if (USER_AND_NOTI_EVENTS.has(event.eventName)) {
        await Promise.all([
          lastValueFrom(this.userServiceClient.emit(event.eventName, event)),
          lastValueFrom(this.notiServiceClient.emit(event.eventName, event)),
        ]);
      } else if (USER_ONLY_EVENTS.has(event.eventName)) {
        await lastValueFrom(
          this.userServiceClient.emit(event.eventName, event),
        );
      } else if (NOTI_ONLY_EVENTS.has(event.eventName)) {
        await lastValueFrom(
          this.notiServiceClient.emit(event.eventName, event),
        );
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
