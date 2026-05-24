export class LogoutResult {
  constructor(
    readonly success: boolean,
    readonly message: string,
    readonly instruction: string,
  ) {}
}
