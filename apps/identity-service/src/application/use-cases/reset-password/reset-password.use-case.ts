import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
import { AuditPublisherPort } from '../../ports/audit-publisher.port';
import { IdentityProviderPort } from '../../ports/identity-provider.port';
import { TokenBlacklistPort } from '../../ports/token-blacklist.port';
import { ResetPasswordCommand } from './reset-password.command';
import { ResetPasswordResult } from './reset-password.result';

const SERVICE_NAME = 'identity-service';

@Injectable()
export class ResetPasswordUseCase
  implements IUseCase<ResetPasswordCommand, ResetPasswordResult>
{
  constructor(
    private readonly identityProvider: IdentityProviderPort,
    private readonly auditPublisher: AuditPublisherPort,
    private readonly tokenBlacklist: TokenBlacklistPort,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<ResetPasswordResult> {
    await this.identityProvider.resetPassword(
      command.userId,
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
        action: 'USER_PASSWORD_RESET',
        resourceType: 'IdentityUser',
        resourceId: command.userId,
        outcome: 'SUCCESS',
        requestContext: command.auditContext,
        metadata: { sessionsRevoked: true },
      }),
    );
    return new ResetPasswordResult(
      true,
      'Password has been reset and active sessions have been revoked.',
    );
  }
}

function currentUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
