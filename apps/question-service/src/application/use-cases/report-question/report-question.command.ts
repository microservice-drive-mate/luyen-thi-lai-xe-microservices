export class ReportQuestionCommand {
  constructor(
    readonly questionId: string,
    readonly userId: string,
    readonly reason: string,
    readonly message?: string,
  ) {}
}
