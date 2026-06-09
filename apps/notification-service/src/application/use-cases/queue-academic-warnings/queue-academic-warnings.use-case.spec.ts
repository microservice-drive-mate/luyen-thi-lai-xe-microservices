import { NotificationEventPublisher } from '../../ports/event-publisher.port';
import { AcademicWarningRecipientRequiredException } from '../../../domain/exceptions/academic-warning-recipient-required.exception';
import { UnsupportedDeliveryChannelException } from '../../../domain/exceptions/unsupported-delivery-channel.exception';
import {
  AcademicWarning,
  NotificationRepository,
  NotificationType,
} from '../../../domain/repositories/notification.repository';
import { QueueAcademicWarningsCommand } from './queue-academic-warnings.command';
import { QueueAcademicWarningsUseCase } from './queue-academic-warnings.use-case';

describe('QueueAcademicWarningsUseCase', () => {
  let repository: {
    createAcademicWarning: jest.Mock;
  };
  let eventPublisher: {
    publish: jest.Mock;
  };
  let useCase: QueueAcademicWarningsUseCase;

  beforeEach(() => {
    repository = {
      createAcademicWarning: jest.fn((warning: AcademicWarning) =>
        Promise.resolve(warning.toSnapshot()),
      ),
    };
    eventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new QueueAcademicWarningsUseCase(
      repository as unknown as NotificationRepository,
      eventPublisher as unknown as NotificationEventPublisher,
    );
  });

  it('queues one warning per recipient and publishes queued events', async () => {
    const result = await useCase.execute(
      new QueueAcademicWarningsCommand(
        ['student-1', 'student-2'],
        [NotificationType.IN_APP],
        'LOW_EXAM_SCORE',
        'HIGH',
        'Review weak question groups before the next attempt.',
        'admin-1',
      ),
    );

    expect(result).toEqual({
      accepted: 2,
      studentIds: ['student-1', 'student-2'],
    });
    expect(repository.createAcademicWarning).toHaveBeenCalledTimes(2);
    expect(eventPublisher.publish).toHaveBeenCalledTimes(2);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'notification.academic-warning.queued',
      expect.objectContaining({
        studentId: 'student-1',
        reason: 'LOW_EXAM_SCORE',
        severity: 'HIGH',
        createdById: 'admin-1',
      }),
    );
  });

  it('throws when no recipient is provided', async () => {
    await expect(
      useCase.execute(
        new QueueAcademicWarningsCommand(
          [],
          [NotificationType.IN_APP],
          'LOW_EXAM_SCORE',
          'HIGH',
          'Review weak question groups before the next attempt.',
          'admin-1',
        ),
      ),
    ).rejects.toBeInstanceOf(AcademicWarningRecipientRequiredException);
    expect(repository.createAcademicWarning).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('throws when the request contains unsupported delivery channels', async () => {
    await expect(
      useCase.execute(
        new QueueAcademicWarningsCommand(
          ['student-1'],
          [NotificationType.EMAIL],
          'LOW_EXAM_SCORE',
          'HIGH',
          'Review weak question groups before the next attempt.',
          'admin-1',
        ),
      ),
    ).rejects.toBeInstanceOf(UnsupportedDeliveryChannelException);
    expect(repository.createAcademicWarning).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });
});
