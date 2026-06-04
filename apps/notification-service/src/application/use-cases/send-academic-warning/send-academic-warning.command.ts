export class SendAcademicWarningCommand {
  constructor(
    readonly studentId: string,
    readonly reason: string,
    readonly severity: string,
    readonly message: string,
    readonly createdById: string,
    readonly studentEmail?: string,
    readonly warningId?: string,
    readonly retryCount?: number,
  ) {}
}
