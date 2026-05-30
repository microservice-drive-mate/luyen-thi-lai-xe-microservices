import { DomainEvent } from '@repo/common';

export class Practice2dSessionCompletedEvent extends DomainEvent {
  get eventName(): string {
    return 'simulation.practice2d.completed';
  }

  constructor(
    readonly sessionId: string,
    readonly studentId: string,
    readonly licenseCategory: string,
    readonly score: number,
    readonly errorCount: number,
    readonly totalPenalty: number,
  ) {
    super();
  }
}
