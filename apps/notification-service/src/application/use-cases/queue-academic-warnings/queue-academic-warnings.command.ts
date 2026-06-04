export class QueueAcademicWarningsCommand {
  constructor(
    readonly studentIds: string[],
    readonly reason: string,
    readonly severity: string,
    readonly message: string,
    readonly createdById: string,
  ) {}
}
