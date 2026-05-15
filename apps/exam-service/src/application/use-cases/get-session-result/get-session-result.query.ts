export class GetSessionResultQuery {
  constructor(
    readonly sessionId: string,
    readonly studentId: string,
  ) {}
}
