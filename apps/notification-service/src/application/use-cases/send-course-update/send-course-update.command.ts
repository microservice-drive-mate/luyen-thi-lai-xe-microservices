export class SendCourseUpdateCommand {
  constructor(
    readonly userId: string,
    readonly courseId: string,
    readonly courseTitle: string,
    readonly updateSummary: string,
    readonly email?: string,
    readonly retryCount?: number,
  ) {}
}
