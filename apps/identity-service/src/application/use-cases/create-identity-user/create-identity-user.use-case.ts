import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
import { IdentityUser } from '../../../domain/aggregates/identity-user/identity-user.aggregate';
import { IdentityUserRepository } from '../../../domain/repositories/identity-user.repository';
import { IdentityEventPublisherPort } from '../../ports/identity-event-publisher.port';
import { IdentityProviderPort } from '../../ports/identity-provider.port';
import { AuditPublisherPort } from '../../ports/audit-publisher.port';
import { CreateIdentityUserCommand } from './create-identity-user.command';
import { CreateIdentityUserResult } from './create-identity-user.result';

const SERVICE_NAME = 'identity-service';

@Injectable()
export class CreateIdentityUserUseCase
  implements IUseCase<CreateIdentityUserCommand, CreateIdentityUserResult>
{
  constructor(
    private readonly identityProvider: IdentityProviderPort,
    private readonly identityUserRepository: IdentityUserRepository,
    private readonly eventPublisher: IdentityEventPublisherPort,
    private readonly auditPublisher: AuditPublisherPort,
  ) {}

  async execute(
    command: CreateIdentityUserCommand,
  ): Promise<CreateIdentityUserResult> {
    const userId = await this.identityProvider.createUser(
      command.email,
      command.temporaryPassword,
      command.fullName,
    );
    await this.identityProvider.assignRealmRole(userId, command.role);

    const user = IdentityUser.create({
      id: userId,
      email: command.email,
      fullName: command.fullName,
      role: command.role,
    });

    await this.identityUserRepository.save(user);
    await this.publishEvents(user);

    void this.auditPublisher.publish(
      createAuditEvent({
        serviceName: SERVICE_NAME,
        actorId: command.auditContext?.actorId ?? 'system',
        actorRole: command.auditContext?.actorRole,
        action: 'IDENTITY_USER_CREATED',
        resourceType: 'IdentityUser',
        resourceId: userId,
        outcome: 'SUCCESS',
        requestContext: command.auditContext,
        metadata: {
          email: command.email,
          fullName: command.fullName,
          role: command.role,
        },
      }),
    );

    return new CreateIdentityUserResult(
      user.id,
      user.email,
      user.fullName,
      user.role,
    );
  }

  private async publishEvents(user: IdentityUser): Promise<void> {
    const events = user.getDomainEvents();
    user.clearDomainEvents();
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }
  }
}
