import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
import { IdentityUserRepository } from '../../../domain/repositories/identity-user.repository';
import { AuditPublisherPort } from '../../ports/audit-publisher.port';
import { CreateIdentityUserCommand } from './create-identity-user.command';
import { CreateIdentityUserResult } from './create-identity-user.result';
import { UserCreationSagaOrchestrator } from '../../saga/user-creation.saga-orchestrator';

const SERVICE_NAME = 'identity-service';

@Injectable()
export class CreateIdentityUserUseCase
  implements IUseCase<CreateIdentityUserCommand, CreateIdentityUserResult>
{
  constructor(
    private readonly sagaOrchestrator: UserCreationSagaOrchestrator,
    private readonly identityUserRepository: IdentityUserRepository,
    private readonly auditPublisher: AuditPublisherPort,
  ) {}

  async execute(
    command: CreateIdentityUserCommand,
  ): Promise<CreateIdentityUserResult> {
    const userId = await this.sagaOrchestrator.execute({
      email: command.email,
      fullName: command.fullName,
      role: command.role,
      password: command.temporaryPassword,
    });

    const user = await this.identityUserRepository.findById(userId);
    if (!user) {
      throw new Error(`Saga completed but user ${userId} not found locally`);
    }

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
}
