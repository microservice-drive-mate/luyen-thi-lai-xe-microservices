export class ListAvailableExamsQuery {
  constructor(
    readonly studentId: string,
    readonly accessToken: string,
    readonly page: number,
    readonly size: number,
  ) {}
}
