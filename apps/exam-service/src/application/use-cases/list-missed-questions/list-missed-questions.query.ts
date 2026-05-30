export class ListMissedQuestionsQuery {
  constructor(
    readonly studentId: string,
    readonly limit: number,
    readonly periodDays?: number,
    readonly mode: 'frequent' | 'recent' = 'frequent',
  ) {}
}
