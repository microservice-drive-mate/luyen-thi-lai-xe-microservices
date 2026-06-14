import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
import { AuditPublisherPort } from '../../ports/audit-publisher.port';
import { IdentityProviderPort } from '../../ports/identity-provider.port';
import { ChangePasswordCommand } from './change-password.command';
import { ChangePasswordResult } from './change-password.result';

const SERVICE_NAME = 'identity-service';

@Injectable()
export class ChangePasswordUseCase
  implements IUseCase<ChangePasswordCommand, ChangePasswordResult>
{
  constructor(
    private readonly identityProvider: IdentityProviderPort,
    private readonly auditPublisher: AuditPublisherPort,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<ChangePasswordResult> {
    await this.identityProvider.changePassword(
      command.userId,
      command.currentPassword,
      command.newPassword,
    );
    void this.auditPublisher.publish(
      createAuditEvent({
        serviceName: SERVICE_NAME,
        actorId: command.userId,
        action: 'USER_PASSWORD_CHANGED',
        resourceType: 'IdentityUser',
        resourceId: command.userId,
        outcome: 'SUCCESS',
        requestContext: command.auditContext,
      }),
    );
    return new ChangePasswordResult(true, 'Password has been changed.');
  }
}
