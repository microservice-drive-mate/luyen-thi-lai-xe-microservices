import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
import {
  IdentityProviderPort,
  IdentityTokenSet,
} from '../../ports/identity-provider.port';
import { AuditPublisherPort } from '../../ports/audit-publisher.port';
import { LoginCommand } from './login.command';

const SERVICE_NAME = 'identity-service';

@Injectable()
export class LoginUseCase implements IUseCase<LoginCommand, IdentityTokenSet> {
  constructor(
    private readonly identityProvider: IdentityProviderPort,
    private readonly auditPublisher: AuditPublisherPort,
  ) {}

  async execute(command: LoginCommand): Promise<IdentityTokenSet> {
    try {
      const tokenSet = await this.identityProvider.login(
        command.username,
        command.password,
      );
      // Successful login: NOT audited — covered by Access Log (ELK).
      return tokenSet;
    } catch (error) {
      // Only failed logins are written to the centralized audit DB.
      void this.auditPublisher.publish(
        createAuditEvent({
          serviceName: SERVICE_NAME,
          actorId: command.username,
          action: 'USER_LOGIN_FAILED',
          resourceType: 'IdentityUser',
          resourceId: command.username,
          outcome: 'FAILURE',
          requestContext: command.auditContext,
          metadata: {
            reason: (error as Error).message,
          },
        }),
      );
      throw error;
    }
  }
}
