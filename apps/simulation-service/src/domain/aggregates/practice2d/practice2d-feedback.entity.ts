import { Entity } from '@repo/common';
import {
  FeedbackSeverity,
  PracticeFeedbackProps,
} from './practice2d-session.types';

export class Practice2dFeedback extends Entity<string> {
  constructor(
    id: string,
    readonly telemetryType: string,
    readonly errorCode: string | null,
    readonly severity: FeedbackSeverity,
    readonly penalty: number,
    readonly message: string,
    readonly hint: string | null,
    readonly telemetry: unknown,
    readonly occurredAt: Date,
  ) {
    super(id);
  }

  static create(props: PracticeFeedbackProps): Practice2dFeedback {
    return new Practice2dFeedback(
      props.id,
      props.telemetryType,
      props.errorCode,
      props.severity,
      props.penalty,
      props.message,
      props.hint,
      props.telemetry,
      props.occurredAt,
    );
  }

  static reconstitute(props: PracticeFeedbackProps): Practice2dFeedback {
    return new Practice2dFeedback(
      props.id,
      props.telemetryType,
      props.errorCode,
      props.severity,
      props.penalty,
      props.message,
      props.hint,
      props.telemetry,
      props.occurredAt,
    );
  }
}
