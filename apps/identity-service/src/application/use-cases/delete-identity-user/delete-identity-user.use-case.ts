import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
import { IdentityUser } from '../../../domain/aggregates/identity-user/identity-user.aggregate';
import { IdentityUserNotFoundException } from '../../../domain/exceptions/identity-user-not-found.exception';
import { IdentityUserRepository } from '../../../domain/repositories/identity-user.repository';
import { IdentityEventPublisherPort } from '../../ports/identity-event-publisher.port';
import { IdentityProviderPort } from '../../ports/identity-provider.port';
import { AuditPublisherPort } from '../../ports/audit-publisher.port';
import { IdentityUserResult } from '../shared/identity-user.result';
import { toIdentityUserResult } from '../shared/identity-user-result.mapper';
import { DeleteIdentityUserCommand } from './delete-identity-user.command';

const SERVICE_NAME = 'identity-service';

@Injectable()
export class DeleteIdentityUserUseCase
  implements IUseCase<DeleteIdentityUserCommand, IdentityUserResult>
{
  constructor(
    private readonly identityProvider: IdentityProviderPort,
    private readonly identityUserRepository: IdentityUserRepository,
    private readonly eventPublisher: IdentityEventPublisherPort,
    private readonly auditPublisher: AuditPublisherPort,
  ) {}

  async execute(
    command: DeleteIdentityUserCommand,
  ): Promise<IdentityUserResult> {
    const user = await this.identityUserRepository.findById(command.userId);
    if (!user) {
      throw new IdentityUserNotFoundException(command.userId);
    }
    if (user.isDeleted) {
      return toIdentityUserResult(user);
    }

    await this.identityProvider.setUserEnabled(command.userId, false);
    user.softDelete(command.deletedById);
    await this.identityUserRepository.save(user);
    await this.publishEvents(user);

    void this.auditPublisher.publish(
      createAuditEvent({
        serviceName: SERVICE_NAME,
        actorId:
          command.auditContext?.actorId ?? command.deletedById ?? 'system',
        actorRole: command.auditContext?.actorRole,
        action: 'IDENTITY_USER_DELETED',
        resourceType: 'IdentityUser',
        resourceId: command.userId,
        outcome: 'SUCCESS',
        requestContext: command.auditContext,
        metadata: {
          deletedById: command.deletedById,
        },
      }),
    );

    return toIdentityUserResult(user);
  }

  private async publishEvents(user: IdentityUser): Promise<void> {
    const events = user.getDomainEvents();
    user.clearDomainEvents();
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }
  }
}
