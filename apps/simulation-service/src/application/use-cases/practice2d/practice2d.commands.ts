import { ClientCapabilities } from '../../../domain/aggregates/practice2d/practice2d-session.types';

export class StartPractice2dSessionCommand {
  constructor(
    readonly studentId: string,
    readonly licenseCategory: string,
    readonly clientCapabilities: ClientCapabilities,
    readonly persistTelemetry: boolean,
  ) {}
}

export class IngestPractice2dTelemetryCommand {
  constructor(
    readonly sessionId: string,
    readonly studentId: string,
    readonly type: string,
    readonly speedKmh?: number,
    readonly laneOffset?: number,
    readonly collision?: boolean,
    readonly signal?: string | null,
    readonly payload?: unknown,
  ) {}
}

export class EndPractice2dSessionCommand {
  constructor(
    readonly sessionId: string,
    readonly studentId: string,
    readonly abandoned = false,
  ) {}
}
