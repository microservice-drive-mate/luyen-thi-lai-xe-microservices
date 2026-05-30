import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
import { IdentityUser } from '../../../domain/aggregates/identity-user/identity-user.aggregate';
import { IdentityUserNotFoundException } from '../../../domain/exceptions/identity-user-not-found.exception';
import { IdentityUserRepository } from '../../../domain/repositories/identity-user.repository';
import { IdentityEventPublisherPort } from '../../ports/identity-event-publisher.port';
import { IdentityProviderPort } from '../../ports/identity-provider.port';
import { AuditPublisherPort } from '../../ports/audit-publisher.port';
import { LockUserCommand } from './lock-user.command';
import { LockUserResult } from './lock-user.result';

const SERVICE_NAME = 'identity-service';

@Injectable()
export class LockUserUseCase
  implements IUseCase<LockUserCommand, LockUserResult>
{
  constructor(
    private readonly identityProvider: IdentityProviderPort,
    private readonly identityUserRepository: IdentityUserRepository,
    private readonly eventPublisher: IdentityEventPublisherPort,
    private readonly auditPublisher: AuditPublisherPort,
  ) {}

  async execute(command: LockUserCommand): Promise<LockUserResult> {
    const user = await this.identityUserRepository.findById(command.userId);
    if (!user) {
      throw new IdentityUserNotFoundException(command.userId);
    }

    await this.identityProvider.setUserEnabled(command.userId, !command.locked);
    user.lock(command.locked);
    await this.identityUserRepository.save(user);
    await this.publishEvents(user);

    void this.auditPublisher.publish(
      createAuditEvent({
        serviceName: SERVICE_NAME,
        actorId: command.auditContext?.actorId ?? 'system',
        actorRole: command.auditContext?.actorRole,
        action: command.locked
          ? 'IDENTITY_USER_LOCKED'
          : 'IDENTITY_USER_UNLOCKED',
        resourceType: 'IdentityUser',
        resourceId: command.userId,
        outcome: 'SUCCESS',
        requestContext: command.auditContext,
        metadata: {
          locked: command.locked,
        },
      }),
    );

    return new LockUserResult(user.id, command.locked);
  }

  private async publishEvents(user: IdentityUser): Promise<void> {
    const events = user.getDomainEvents();
    user.clearDomainEvents();
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }
  }
}
