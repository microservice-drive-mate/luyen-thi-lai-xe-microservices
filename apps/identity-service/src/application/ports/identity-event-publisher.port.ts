import { DomainEvent } from '@repo/common';

export abstract class IdentityEventPublisherPort {
  abstract publish(event: DomainEvent): Promise<void>;
}
