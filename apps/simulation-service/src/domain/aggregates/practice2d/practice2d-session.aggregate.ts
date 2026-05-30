import { AggregateRoot } from '@repo/common';
import { Practice2dSessionCompletedEvent } from '../../events/practice2d-session-completed.event';
import {
  Practice2dInvalidRequestException,
  Practice2dSessionNotActiveException,
  Practice2dSessionUnauthorizedException,
  Practice2dUnsupportedClientException,
} from '../../exceptions/practice2d.exceptions';
import { Practice2dFeedback } from './practice2d-feedback.entity';
import {
  ClientCapabilities,
  CreatePractice2dSessionProps,
  FeedbackSeverity,
  Practice2dSessionStatus,
  PracticeTelemetryInput,
  ReconstitutePractice2dSessionProps,
} from './practice2d-session.types';

export class Practice2dSession extends AggregateRoot<string> {
  private _status: Practice2dSessionStatus;
  private _telemetrySnapshot: unknown | null;
  private _totalEvents: number;
  private _errorCount: number;
  private _totalPenalty: number;
  private _score: number | null;
  private _summary: unknown;
  private _endedAt: Date | null;
  private _feedbackEvents: Practice2dFeedback[];

  private constructor(
    id: string,
    readonly studentId: string,
    readonly licenseCategory: string,
    readonly clientCapabilities: ClientCapabilities,
    readonly persistTelemetry: boolean,
    readonly startedAt: Date,
    props: {
      status: Practice2dSessionStatus;
      telemetrySnapshot: unknown | null;
      totalEvents: number;
      errorCount: number;
      totalPenalty: number;
      score: number | null;
      summary: unknown;
      endedAt: Date | null;
      feedbackEvents: Practice2dFeedback[];
    },
  ) {
    super(id);
    this._status = props.status;
    this._telemetrySnapshot = props.telemetrySnapshot;
    this._totalEvents = props.totalEvents;
    this._errorCount = props.errorCount;
    this._totalPenalty = props.totalPenalty;
    this._score = props.score;
    this._summary = props.summary;
    this._endedAt = props.endedAt;
    this._feedbackEvents = props.feedbackEvents;
  }

  static create(props: CreatePractice2dSessionProps): Practice2dSession {
    if (!props.studentId?.trim()) {
      throw new Practice2dInvalidRequestException('studentId is required');
    }
    if (!props.licenseCategory?.trim()) {
      throw new Practice2dInvalidRequestException(
        'licenseCategory is required',
      );
    }
    if (!props.clientCapabilities.canvas && !props.clientCapabilities.webgl) {
      throw new Practice2dUnsupportedClientException(
        'Client must support canvas or WebGL. (MSG131)',
      );
    }
    if (!props.clientCapabilities.keyboard && !props.clientCapabilities.touch) {
      throw new Practice2dUnsupportedClientException(
        'Client must support keyboard or touch input. (MSG131)',
      );
    }

    return new Practice2dSession(
      crypto.randomUUID(),
      props.studentId,
      props.licenseCategory,
      props.clientCapabilities,
      props.persistTelemetry,
      new Date(),
      {
        status: Practice2dSessionStatus.IN_PROGRESS,
        telemetrySnapshot: null,
        totalEvents: 0,
        errorCount: 0,
        totalPenalty: 0,
        score: null,
        summary: {},
        endedAt: null,
        feedbackEvents: [],
      },
    );
  }

  static reconstitute(
    props: ReconstitutePractice2dSessionProps,
  ): Practice2dSession {
    return new Practice2dSession(
      props.id,
      props.studentId,
      props.licenseCategory,
      props.clientCapabilities,
      props.persistTelemetry,
      props.startedAt,
      {
        status: props.status,
        telemetrySnapshot: props.telemetrySnapshot,
        totalEvents: props.totalEvents,
        errorCount: props.errorCount,
        totalPenalty: props.totalPenalty,
        score: props.score,
        summary: props.summary,
        endedAt: props.endedAt,
        feedbackEvents: props.feedbackEvents.map(
          Practice2dFeedback.reconstitute,
        ),
      },
    );
  }

  assertOwner(studentId: string): void {
    if (this.studentId !== studentId) {
      throw new Practice2dSessionUnauthorizedException(this.id);
    }
  }

  ingestTelemetry(input: PracticeTelemetryInput): Practice2dFeedback {
    this.assertActive();
    if (!input.type?.trim()) {
      throw new Practice2dInvalidRequestException('telemetry type is required');
    }

    this._totalEvents += 1;
    if (this.persistTelemetry) {
      this._telemetrySnapshot = input;
    }

    const feedback = this.detectFeedback(input);
    this._feedbackEvents.push(feedback);
    if (feedback.penalty > 0 || feedback.severity === FeedbackSeverity.FATAL) {
      this._errorCount += 1;
      this._totalPenalty += feedback.penalty;
    }
    return feedback;
  }

  end(abandoned = false): void {
    this.assertActive();
    this._status = abandoned
      ? Practice2dSessionStatus.ABANDONED
      : Practice2dSessionStatus.COMPLETED;
    this._endedAt = new Date();
    this._score = Math.max(0, 100 - this._totalPenalty);
    this._summary = {
      totalEvents: this._totalEvents,
      errorCount: this._errorCount,
      totalPenalty: this._totalPenalty,
      score: this._score,
      status: this._status,
    };

    if (!abandoned) {
      this.addDomainEvent(
        new Practice2dSessionCompletedEvent(
          this.id,
          this.studentId,
          this.licenseCategory,
          this._score,
          this._errorCount,
          this._totalPenalty,
        ),
      );
    }
  }

  private detectFeedback(input: PracticeTelemetryInput): Practice2dFeedback {
    if (input.collision) {
      return this.feedback(input, 'COLLISION', FeedbackSeverity.FATAL, 100);
    }
    if (typeof input.speedKmh === 'number' && input.speedKmh > 60) {
      return this.feedback(input, 'OVERSPEED', FeedbackSeverity.WARNING, 10);
    }
    if (
      typeof input.laneOffset === 'number' &&
      Math.abs(input.laneOffset) > 1
    ) {
      return this.feedback(
        input,
        'LANE_DEPARTURE',
        FeedbackSeverity.WARNING,
        5,
      );
    }
    return this.feedback(input, null, FeedbackSeverity.INFO, 0);
  }

  private feedback(
    input: PracticeTelemetryInput,
    errorCode: string | null,
    severity: FeedbackSeverity,
    penalty: number,
  ): Practice2dFeedback {
    const messages: Record<string, { message: string; hint: string }> = {
      COLLISION: {
        message: 'Detected collision during practice.',
        hint: 'Reduce speed and keep safe distance.',
      },
      OVERSPEED: {
        message: 'Speed exceeded the configured practice threshold.',
        hint: 'Slow down before entering the next checkpoint.',
      },
      LANE_DEPARTURE: {
        message: 'Vehicle moved outside the expected lane range.',
        hint: 'Steer gently back to the center of the lane.',
      },
    };
    const copy = errorCode ? messages[errorCode] : null;
    return Practice2dFeedback.create({
      telemetryType: input.type,
      errorCode,
      severity,
      penalty,
      message: copy?.message ?? 'Telemetry received.',
      hint: copy?.hint ?? null,
      telemetry: input.payload ?? input,
      occurredAt: input.occurredAt ?? new Date(),
    });
  }

  private assertActive(): void {
    if (this._status !== Practice2dSessionStatus.IN_PROGRESS) {
      throw new Practice2dSessionNotActiveException(this.id);
    }
  }

  get status(): Practice2dSessionStatus {
    return this._status;
  }
  get telemetrySnapshot(): unknown | null {
    return this._telemetrySnapshot;
  }
  get totalEvents(): number {
    return this._totalEvents;
  }
  get errorCount(): number {
    return this._errorCount;
  }
  get totalPenalty(): number {
    return this._totalPenalty;
  }
  get score(): number | null {
    return this._score;
  }
  get summary(): unknown {
    return this._summary;
  }
  get endedAt(): Date | null {
    return this._endedAt;
  }
  get feedbackEvents(): Practice2dFeedback[] {
    return [...this._feedbackEvents];
  }
}
