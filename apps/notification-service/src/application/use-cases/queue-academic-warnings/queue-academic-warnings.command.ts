import { NotificationType } from '../../../domain/repositories/notification.repository';

export class QueueAcademicWarningsCommand {
  constructor(
    readonly studentIds: string[],
    readonly deliveryChannels: NotificationType[],
    readonly reason: string,
    readonly severity: string,
    readonly message: string,
    readonly createdById: string,
  ) {}
}
