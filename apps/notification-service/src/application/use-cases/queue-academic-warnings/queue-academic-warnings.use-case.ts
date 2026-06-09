import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import crypto from 'node:crypto';
import { NotificationEventPublisher } from '../../ports/event-publisher.port';
import { AcademicWarningRecipientRequiredException } from '../../../domain/exceptions/academic-warning-recipient-required.exception';
import { UnsupportedDeliveryChannelException } from '../../../domain/exceptions/unsupported-delivery-channel.exception';
import {
  AcademicWarning,
  NotificationRepository,
  NotificationType,
} from '../../../domain/repositories/notification.repository';
import { QueueAcademicWarningsCommand } from './queue-academic-warnings.command';

export interface QueueAcademicWarningsResult {
  accepted: number;
  studentIds: string[];
}

@Injectable()
export class QueueAcademicWarningsUseCase
  implements IUseCase<QueueAcademicWarningsCommand, QueueAcademicWarningsResult>
{
  constructor(
    private readonly repository: NotificationRepository,
    private readonly eventPublisher: NotificationEventPublisher,
  ) {}

  async execute(
    command: QueueAcademicWarningsCommand,
  ): Promise<QueueAcademicWarningsResult> {
    if (command.studentIds.length === 0) {
      throw new AcademicWarningRecipientRequiredException();
    }

    const unsupportedChannels = command.deliveryChannels.filter(
      (channel) => channel !== NotificationType.IN_APP,
    );
    if (unsupportedChannels.length > 0) {
      throw new UnsupportedDeliveryChannelException();
    }

    const warnings = await Promise.all(
      command.studentIds.map((studentId) =>
        this.repository.createAcademicWarning(
          AcademicWarning.create({
            id: crypto.randomUUID(),
            studentId,
            reason: command.reason,
            severity: command.severity,
            message: command.message,
            createdById: command.createdById,
          }),
        ),
      ),
    );

    await Promise.all(
      warnings.map((warning) =>
        this.eventPublisher.publish('notification.academic-warning.queued', {
          warningId: warning.id,
          studentId: warning.studentId,
          reason: warning.reason,
          severity: warning.severity,
          message: warning.message,
          createdById: warning.createdById,
        }),
      ),
    );

    return {
      accepted: command.studentIds.length,
      studentIds: command.studentIds,
    };
  }
}
