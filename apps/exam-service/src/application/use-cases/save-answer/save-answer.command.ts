export class SaveAnswerCommand {
  constructor(
    readonly sessionId: string,
    readonly studentId: string,
    readonly questionId: string,
    readonly selectedOptionId?: string | null,
    readonly isBookmarked?: boolean,
  ) {}
}
