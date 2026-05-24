export class LogoutCommand {
  constructor(
    readonly accessToken: string,
    readonly refreshToken: string,
  ) {}
}
