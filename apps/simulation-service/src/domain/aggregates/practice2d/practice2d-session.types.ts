export enum Practice2dSessionStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
}

export enum FeedbackSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  FATAL = 'FATAL',
}

export interface ClientCapabilities {
  canvas?: boolean;
  webgl?: boolean;
  keyboard?: boolean;
  touch?: boolean;
}

export interface PracticeTelemetryInput {
  type: string;
  speedKmh?: number;
  laneOffset?: number;
  collision?: boolean;
  signal?: string | null;
  payload?: unknown;
  occurredAt?: Date;
}

export interface PracticeFeedbackProps {
  id: string;
  telemetryType: string;
  errorCode: string | null;
  severity: FeedbackSeverity;
  penalty: number;
  message: string;
  hint: string | null;
  telemetry: unknown;
  occurredAt: Date;
}

export interface CreatePractice2dSessionProps {
  id: string;
  studentId: string;
  licenseCategory: string;
  clientCapabilities: ClientCapabilities;
  persistTelemetry: boolean;
}

export interface ReconstitutePractice2dSessionProps {
  id: string;
  studentId: string;
  licenseCategory: string;
  status: Practice2dSessionStatus;
  clientCapabilities: ClientCapabilities;
  persistTelemetry: boolean;
  telemetrySnapshot: unknown | null;
  totalEvents: number;
  errorCount: number;
  totalPenalty: number;
  score: number | null;
  summary: unknown;
  startedAt: Date;
  endedAt: Date | null;
  feedbackEvents: PracticeFeedbackProps[];
}
