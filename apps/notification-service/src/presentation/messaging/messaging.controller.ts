import { Controller } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { MetricsService } from '@repo/common';
import { NotificationRepository } from '../../domain/repositories/notification.repository';

interface NotificationEventPayload {
  studentId?: string;
  userId?: string;
  sessionId?: string;
  licenseCategory?: string;
  isPassed?: boolean;
}

@Controller()
export class MessagingController {
  private readonly logger = new Logger(MessagingController.name);

  constructor(
    private readonly repository: NotificationRepository,
    private readonly metricsService: MetricsService,
  ) {}

  @EventPattern('exam.session.passed')
  async handleExamPassed(
    @Payload() payload: NotificationEventPayload,
  ): Promise<void> {
    await this.handleSafely('exam.session.passed', async () => {
      const userId = payload.studentId ?? payload.userId;
      if (!userId) return 'skipped';
      await this.repository.createNotification({
        userId,
        title: 'Exam passed',
        body: `You passed the ${payload.licenseCategory ?? ''} exam.`,
        data: payload,
        sentAt: new Date(),
      });
      return 'success';
    });
  }

  @EventPattern('exam.session.failed')
  async handleExamFailed(
    @Payload() payload: NotificationEventPayload,
  ): Promise<void> {
    await this.handleSafely('exam.session.failed', async () => {
      const userId = payload.studentId ?? payload.userId;
      if (!userId) return 'skipped';
      await this.repository.createNotification({
        userId,
        title: 'Exam failed',
        body: 'Review weak questions and try another practice exam.',
        data: payload,
        sentAt: new Date(),
      });
      return 'success';
    });
  }

  private async handleSafely(
    eventName: string,
    handler: () => Promise<'success' | 'skipped'>,
  ): Promise<void> {
    try {
      const status = await handler();
      this.metricsService.recordNotificationDelivery({
        channel: 'in_app',
        event: eventName,
        status,
      });
    } catch (error) {
      this.metricsService.recordNotificationDelivery({
        channel: 'in_app',
        event: eventName,
        status: 'failure',
      });
      this.logger.error(
        `Failed to handle ${eventName}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
