export class SubmitSessionCommand {
  constructor(
    readonly sessionId: string,
    readonly studentId: string,
  ) {}
}
