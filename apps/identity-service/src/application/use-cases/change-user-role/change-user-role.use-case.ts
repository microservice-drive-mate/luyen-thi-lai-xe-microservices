import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { IdentityUser } from '../../../domain/aggregates/identity-user/identity-user.aggregate';
import { IdentityUserNotFoundException } from '../../../domain/exceptions/identity-user-not-found.exception';
import { IdentityUserRepository } from '../../../domain/repositories/identity-user.repository';
import { IdentityEventPublisherPort } from '../../ports/identity-event-publisher.port';
import { IdentityProviderPort } from '../../ports/identity-provider.port';
import { ChangeUserRoleCommand } from './change-user-role.command';
import { ChangeUserRoleResult } from './change-user-role.result';

@Injectable()
export class ChangeUserRoleUseCase
  implements IUseCase<ChangeUserRoleCommand, ChangeUserRoleResult>
{
  constructor(
    private readonly identityProvider: IdentityProviderPort,
    private readonly identityUserRepository: IdentityUserRepository,
    private readonly eventPublisher: IdentityEventPublisherPort,
  ) {}

  async execute(command: ChangeUserRoleCommand): Promise<ChangeUserRoleResult> {
    const user = await this.identityUserRepository.findById(command.userId);
    if (!user) {
      throw new IdentityUserNotFoundException(command.userId);
    }

    await this.identityProvider.assignRealmRole(command.userId, command.role);
    user.changeRole(command.role);
    await this.identityUserRepository.save(user);
    await this.publishEvents(user);
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
