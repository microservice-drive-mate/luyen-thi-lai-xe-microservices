import { Practice2dSession } from '../../../domain/aggregates/practice2d/practice2d-session.aggregate';
import { FeedbackSeverity } from '../../../domain/aggregates/practice2d/practice2d-session.types';

export interface Practice2dFeedbackResult {
  id: string;
  telemetryType: string;
  errorCode: string | null;
  severity: FeedbackSeverity;
  penalty: number;
  message: string;
  hint: string | null;
  occurredAt: Date;
}

export class Practice2dSessionResult {
  constructor(
    readonly id: string,
    readonly studentId: string,
    readonly licenseCategory: string,
    readonly status: string,
    readonly totalEvents: number,
    readonly errorCount: number,
    readonly totalPenalty: number,
    readonly score: number | null,
    readonly summary: unknown,
    readonly startedAt: Date,
    readonly endedAt: Date | null,
    readonly feedbackEvents: Practice2dFeedbackResult[],
  ) {}

  static fromAggregate(session: Practice2dSession): Practice2dSessionResult {
    return new Practice2dSessionResult(
      session.id,
      session.studentId,
      session.licenseCategory,
      session.status,
      session.totalEvents,
      session.errorCount,
      session.totalPenalty,
      session.score,
      session.summary,
      session.startedAt,
      session.endedAt,
      session.feedbackEvents.map((item) => ({
        id: item.id,
        telemetryType: item.telemetryType,
        errorCode: item.errorCode,
        severity: item.severity,
        penalty: item.penalty,
        message: item.message,
        hint: item.hint,
        occurredAt: item.occurredAt,
      })),
    );
  }
}
