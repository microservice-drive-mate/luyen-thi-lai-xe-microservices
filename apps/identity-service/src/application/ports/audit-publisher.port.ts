import { AuditEventEnvelope } from '@repo/common';

/**
 * Port (abstract class) in Application Layer.
 * Follows the Ports & Adapters (Hexagonal Architecture) pattern.
 * The Infrastructure layer provides the concrete adapter.
 */
export abstract class AuditPublisherPort {
  abstract publish(event: AuditEventEnvelope): Promise<void>;
}
