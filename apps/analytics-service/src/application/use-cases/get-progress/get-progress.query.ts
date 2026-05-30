export class GetProgressQuery {
  constructor(
    readonly studentId: string,
    readonly licenseTier?: string | null,
  ) {}
}
