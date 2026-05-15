export class DeleteQuestionCommand {
  constructor(
    readonly questionId: string,
    readonly deletedById: string,
    readonly expectedVersion: number,
  ) {}
}
