import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AuditEventEnvelope } from '@repo/common';
import { RecordAuditLogUseCase } from '../../application/use-cases/record-audit-log.use-case';

@Controller()
export class MessagingController {
  private readonly logger = new Logger(MessagingController.name);

  constructor(private readonly recordAuditLogUseCase: RecordAuditLogUseCase) {}

  @EventPattern('security.audit.recorded')
  async handleAuditRecorded(
    @Payload() payload: AuditEventEnvelope,
  ): Promise<void> {
    try {
      await this.recordAuditLogUseCase.execute(payload);
    } catch (error) {
      this.logger.error(
        `Failed to persist audit event ${payload.eventId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
