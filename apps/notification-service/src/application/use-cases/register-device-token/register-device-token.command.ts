export class RegisterDeviceTokenCommand {
  constructor(
    readonly userId: string,
    readonly token: string,
    readonly platform: string,
  ) {}
}
