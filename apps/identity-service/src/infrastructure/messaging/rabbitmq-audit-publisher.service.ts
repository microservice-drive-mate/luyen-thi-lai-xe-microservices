import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AuditEventEnvelope } from '@repo/common';
import { lastValueFrom } from 'rxjs';
import { AuditPublisherPort } from '../../application/ports/audit-publisher.port';

export const AUDIT_SERVICE_CLIENT = 'AUDIT_SERVICE_CLIENT';

/**
 * Infrastructure adapter implementing AuditPublisherPort.
 * Emits audit events directly to the audit_service_events queue via RabbitMQ.
 *
 * Design decision: Fire-and-forget — publish failures are logged as warnings
 * and NEVER propagate to the caller, so a RabbitMQ hiccup cannot break
 * the core identity flow.
 */
@Injectable()
export class RabbitMqAuditPublisher extends AuditPublisherPort {
  private readonly logger = new Logger(RabbitMqAuditPublisher.name);

  constructor(
    @Inject(AUDIT_SERVICE_CLIENT)
    private readonly auditServiceClient: ClientProxy,
  ) {
    super();
  }

  async publish(event: AuditEventEnvelope): Promise<void> {
    try {
      await lastValueFrom(this.auditServiceClient.emit(event.eventName, event));
      this.logger.log(
        `Audit event published: action=${event.action} resourceId=${event.resourceId} outcome=${event.outcome}`,
      );
    } catch (error) {
      // Fire-and-forget: log the error but do NOT re-throw.
      // Audit failure must not impact business operations.
      this.logger.warn(
        `Failed to publish audit event (action=${event.action}): ${(error as Error).message}`,
      );
    }
  }
}
