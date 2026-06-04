export class MarkNotificationReadCommand {
  constructor(
    readonly notificationId: string,
    readonly userId: string,
  ) {}
}
