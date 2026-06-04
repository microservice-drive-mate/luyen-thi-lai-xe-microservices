export class SendPasswordResetCommand {
  constructor(
    readonly userId: string,
    readonly email: string,
    readonly resetUrl: string,
    readonly retryCount?: number,
  ) {}
}
