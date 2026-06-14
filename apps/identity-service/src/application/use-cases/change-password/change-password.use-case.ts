import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
import { AuditPublisherPort } from '../../ports/audit-publisher.port';
import { IdentityProviderPort } from '../../ports/identity-provider.port';
import { TokenBlacklistPort } from '../../ports/token-blacklist.port';
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
    private readonly tokenBlacklist: TokenBlacklistPort,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<ChangePasswordResult> {
    await this.identityProvider.changePassword(
      command.userId,
      command.currentPassword,
      command.newPassword,
    );
    await this.identityProvider.logoutUserAllSessions(command.userId);
    await this.tokenBlacklist.revokeUserTokensIssuedBefore(
      command.userId,
      currentUnixSeconds(),
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
        metadata: { sessionsRevoked: true },
      }),
    );
    return new ChangePasswordResult(
      true,
      'Password has been changed and active sessions have been revoked.',
    );
  }
}

function currentUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
