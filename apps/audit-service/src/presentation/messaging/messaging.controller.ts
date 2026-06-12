import { Controller, Inject, Logger } from '@nestjs/common';
import { ClientProxy, EventPattern, Payload } from '@nestjs/microservices';
import { AuditEventEnvelope } from '@repo/common';
import { lastValueFrom } from 'rxjs';
import { RecordAuditLogUseCase } from '../../application/use-cases/record-audit-log.use-case';

export const ANALYTICS_SERVICE_CLIENT = 'ANALYTICS_SERVICE_CLIENT';

@Controller()
export class MessagingController {
  private readonly logger = new Logger(MessagingController.name);

  constructor(
    private readonly recordAuditLogUseCase: RecordAuditLogUseCase,
    @Inject(ANALYTICS_SERVICE_CLIENT)
    private readonly analyticsClient: ClientProxy,
  ) {}

  @EventPattern('security.audit.recorded')
  async handleAuditRecorded(
    @Payload() payload: AuditEventEnvelope,
  ): Promise<void> {
    try {
      await this.recordAuditLogUseCase.execute(payload);
      await this.publishToAnalytics(payload);
    } catch (error) {
      this.logger.error(
        `Failed to persist audit event ${payload.eventId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private async publishToAnalytics(payload: AuditEventEnvelope): Promise<void> {
    try {
      await lastValueFrom(
        this.analyticsClient.emit('security.audit.recorded', payload),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to route audit event ${payload.eventId} to analytics: ${
          (error as Error).message
        }`,
      );
    }
  }
}
