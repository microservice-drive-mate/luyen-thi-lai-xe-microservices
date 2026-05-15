export class GetSessionQuestionsQuery {
  constructor(
    readonly sessionId: string,
    readonly studentId: string,
  ) {}
}
