export class StartSessionCommand {
  constructor(
    readonly templateId: string,
    readonly studentId: string,
    readonly accessToken: string,
  ) {}
}
