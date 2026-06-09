import { DomainException } from '@repo/common';

export class UnsupportedDeliveryChannelException extends DomainException {
  readonly code = 'UNSUPPORTED_DELIVERY_CHANNEL';

  constructor() {
    super(
      'Only IN_APP delivery can be requested from this endpoint; EMAIL/PUSH are resolved by notification-service config and event payload.',
    );
  }
}
