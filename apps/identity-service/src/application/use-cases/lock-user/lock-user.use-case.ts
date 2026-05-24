import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { IdentityUser } from '../../../domain/aggregates/identity-user/identity-user.aggregate';
import { IdentityUserNotFoundException } from '../../../domain/exceptions/identity-user-not-found.exception';
import { IdentityUserRepository } from '../../../domain/repositories/identity-user.repository';
import { IdentityEventPublisherPort } from '../../ports/identity-event-publisher.port';
import { IdentityProviderPort } from '../../ports/identity-provider.port';
import { LockUserCommand } from './lock-user.command';
import { LockUserResult } from './lock-user.result';

@Injectable()
export class LockUserUseCase
  implements IUseCase<LockUserCommand, LockUserResult>
{
  constructor(
    private readonly identityProvider: IdentityProviderPort,
    private readonly identityUserRepository: IdentityUserRepository,
    private readonly eventPublisher: IdentityEventPublisherPort,
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
