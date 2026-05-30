import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
import { IdentityUser } from '../../../domain/aggregates/identity-user/identity-user.aggregate';
import { IdentityUserNotFoundException } from '../../../domain/exceptions/identity-user-not-found.exception';
import { IdentityUserRepository } from '../../../domain/repositories/identity-user.repository';
import { IdentityEventPublisherPort } from '../../ports/identity-event-publisher.port';
import { IdentityProviderPort } from '../../ports/identity-provider.port';
import { AuditPublisherPort } from '../../ports/audit-publisher.port';
import { ChangeUserRoleCommand } from './change-user-role.command';
import { ChangeUserRoleResult } from './change-user-role.result';

const SERVICE_NAME = 'identity-service';

@Injectable()
export class ChangeUserRoleUseCase
  implements IUseCase<ChangeUserRoleCommand, ChangeUserRoleResult>
{
  constructor(
    private readonly identityProvider: IdentityProviderPort,
    private readonly identityUserRepository: IdentityUserRepository,
    private readonly eventPublisher: IdentityEventPublisherPort,
    private readonly auditPublisher: AuditPublisherPort,
  ) {}

  async execute(command: ChangeUserRoleCommand): Promise<ChangeUserRoleResult> {
    const user = await this.identityUserRepository.findById(command.userId);
    if (!user) {
      throw new IdentityUserNotFoundException(command.userId);
    }

    const previousRole = user.role;
    await this.identityProvider.assignRealmRole(command.userId, command.role);
    user.changeRole(command.role);
    await this.identityUserRepository.save(user);
    await this.publishEvents(user);

    void this.auditPublisher.publish(
      createAuditEvent({
        serviceName: SERVICE_NAME,
        actorId: command.auditContext?.actorId ?? 'system',
        actorRole: command.auditContext?.actorRole,
        action: 'IDENTITY_USER_ROLE_CHANGED',
        resourceType: 'IdentityUser',
        resourceId: command.userId,
        outcome: 'SUCCESS',
        requestContext: command.auditContext,
        metadata: {
          previousRole,
          newRole: command.role,
        },
      }),
    );

    return new ChangeUserRoleResult(user.id, user.role);
  }

  private async publishEvents(user: IdentityUser): Promise<void> {
    const events = user.getDomainEvents();
    user.clearDomainEvents();
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }
  }
}
