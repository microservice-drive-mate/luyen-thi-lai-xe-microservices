import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import {
  IdentityProviderPort,
  IdentityTokenSet,
} from '../../ports/identity-provider.port';
import { RefreshTokenCommand } from './refresh-token.command';

@Injectable()
export class RefreshTokenUseCase
  implements IUseCase<RefreshTokenCommand, IdentityTokenSet>
{
  constructor(private readonly identityProvider: IdentityProviderPort) {}

  execute(command: RefreshTokenCommand): Promise<IdentityTokenSet> {
    return this.identityProvider.refreshToken(command.refreshToken);
  }
}
