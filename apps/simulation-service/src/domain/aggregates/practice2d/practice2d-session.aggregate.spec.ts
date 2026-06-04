import { Practice2dSessionCompletedEvent } from '../../events/practice2d-session-completed.event';
import { Practice2dSession } from './practice2d-session.aggregate';
import {
  FeedbackSeverity,
  Practice2dSessionStatus,
} from './practice2d-session.types';

function createSession(): Practice2dSession {
  return Practice2dSession.create({
    id: 'practice-session-1',
    studentId: 'student-1',
    licenseCategory: 'B2',
    clientCapabilities: {
      canvas: true,
      keyboard: true,
    },
    persistTelemetry: true,
  });
}

describe('Practice2dSession', () => {
  it('records feedback and penalties from telemetry', () => {
    const session = createSession();

    const feedback = session.ingestTelemetry(
      {
        type: 'vehicle-state',
        speedKmh: 72,
        payload: { speedKmh: 72 },
      },
      'feedback-1',
    );

    expect(feedback.severity).toBe(FeedbackSeverity.WARNING);
    expect(feedback.errorCode).toBe('OVERSPEED');
    expect(session.totalEvents).toBe(1);
    expect(session.errorCount).toBe(1);
    expect(session.totalPenalty).toBe(10);
    expect(session.telemetrySnapshot).toEqual({
      type: 'vehicle-state',
      speedKmh: 72,
      payload: { speedKmh: 72 },
    });
  });

  it('completes with a score and domain event', () => {
    const session = createSession();
    session.ingestTelemetry(
      {
        type: 'vehicle-state',
        laneOffset: 2,
      },
      'feedback-1',
    );

    session.end();

    expect(session.status).toBe(Practice2dSessionStatus.COMPLETED);
    expect(session.score).toBe(95);
    expect(session.getDomainEvents()).toEqual([
      expect.any(Practice2dSessionCompletedEvent),
    ]);
  });
});
