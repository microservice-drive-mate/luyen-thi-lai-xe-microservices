import { Injectable, Logger } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { IdentityProviderPort } from '../../ports/identity-provider.port';
import { ForgotPasswordCommand } from './forgot-password.command';
import { ForgotPasswordResult } from './forgot-password.result';

@Injectable()
export class ForgotPasswordUseCase
  implements IUseCase<ForgotPasswordCommand, ForgotPasswordResult>
{
  private readonly logger = new Logger(ForgotPasswordUseCase.name);

  constructor(private readonly identityProvider: IdentityProviderPort) {}

  async execute(command: ForgotPasswordCommand): Promise<ForgotPasswordResult> {
    const normalizedEmail = command.email.trim().toLowerCase();
    const response = new ForgotPasswordResult(
      true,
      'Neu email nay ton tai, huong dan dat lai mat khau da duoc gui.',
    );

    const user = await this.identityProvider.findUserByEmail(normalizedEmail);
    if (!user?.id || user.enabled === false) {
      this.logger.log(
        `Forgot password requested for non-existing or disabled email: ${normalizedEmail}`,
      );
      return response;
    }

    await this.identityProvider.sendPasswordResetEmail(user.id);
    return response;
  }
}
