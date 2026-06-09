import { DomainException } from '@repo/common';

export class NotificationNotFoundException extends DomainException {
  readonly code = 'NOTIFICATION_NOT_FOUND';

  constructor(_notificationId: string) {
    super('Notification not found.');
  }
}
