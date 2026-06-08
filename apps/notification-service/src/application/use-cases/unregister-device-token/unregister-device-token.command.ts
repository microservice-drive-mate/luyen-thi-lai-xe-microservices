export class UnregisterDeviceTokenCommand {
  constructor(
    readonly userId: string,
    readonly token: string,
  ) {}
}
