export type ExamResultEventType = 'exam.session.passed' | 'exam.session.failed';

export class SendExamResultCommand {
  constructor(
    readonly eventType: ExamResultEventType,
    readonly userId: string,
    readonly email?: string,
    readonly licenseCategory?: string,
    readonly sessionId?: string,
    readonly score?: number,
    readonly retryCount?: number,
  ) {}
}
