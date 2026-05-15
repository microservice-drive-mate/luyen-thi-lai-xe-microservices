export class UpdateTemplateCommand {
  constructor(
    readonly id: string,
    readonly expectedVersion: number,
    readonly name?: string,
    readonly totalQuestions?: number,
    readonly passingScore?: number,
    readonly durationMinutes?: number,
    readonly isActive?: boolean,
  ) {}
}
