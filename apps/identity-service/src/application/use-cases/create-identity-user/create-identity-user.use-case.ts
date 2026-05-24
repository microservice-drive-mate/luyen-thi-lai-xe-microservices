import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { IdentityUser } from '../../../domain/aggregates/identity-user/identity-user.aggregate';
import { IdentityUserRepository } from '../../../domain/repositories/identity-user.repository';
import { IdentityEventPublisherPort } from '../../ports/identity-event-publisher.port';
import { IdentityProviderPort } from '../../ports/identity-provider.port';
import { CreateIdentityUserCommand } from './create-identity-user.command';
import { CreateIdentityUserResult } from './create-identity-user.result';

@Injectable()
export class CreateIdentityUserUseCase
  implements IUseCase<CreateIdentityUserCommand, CreateIdentityUserResult>
{
  constructor(
    private readonly identityProvider: IdentityProviderPort,
    private readonly identityUserRepository: IdentityUserRepository,
    private readonly eventPublisher: IdentityEventPublisherPort,
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
