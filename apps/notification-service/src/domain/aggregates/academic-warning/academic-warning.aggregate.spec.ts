import {
  AcademicWarning,
  AcademicWarningDeliveryStatus,
} from './academic-warning.aggregate';

describe('AcademicWarning', () => {
  it('moves from pending to queued after dispatch', () => {
    const warning = AcademicWarning.create({
      id: 'warning-1',
      studentId: 'student-1',
      reason: 'LOW_PROGRESS',
      severity: 'HIGH',
      message: 'Study more',
      createdById: 'admin-1',
    });

    warning.markQueued('notification-1', new Date('2026-06-04T00:00:00.000Z'));

    expect(warning.toSnapshot()).toMatchObject({
      deliveryStatus: AcademicWarningDeliveryStatus.QUEUED,
      notificationId: 'notification-1',
      nextRetryAt: null,
      lastError: null,
    });
  });

  it('marks retry warnings as failed after the max attempt', () => {
    const warning = AcademicWarning.reconstitute({
      ...AcademicWarning.create({
        id: 'warning-1',
        studentId: 'student-1',
        reason: 'LOW_PROGRESS',
        severity: 'HIGH',
        message: 'Study more',
        createdById: 'admin-1',
      }).toSnapshot(),
      retryAttempts: 2,
    });

    warning.recordRetryFailure(
      'mail provider unavailable',
      new Date('2026-06-04T00:00:00.000Z'),
    );

    expect(warning.toSnapshot()).toMatchObject({
      deliveryStatus: AcademicWarningDeliveryStatus.FAILED,
      retryAttempts: 3,
      nextRetryAt: null,
      lastError: 'mail provider unavailable',
    });
  });
});
