export class SendWelcomeEmailCommand {
  constructor(
    readonly userId: string,
    readonly email: string,
    readonly fullName?: string,
    readonly retryCount?: number,
  ) {}
}
