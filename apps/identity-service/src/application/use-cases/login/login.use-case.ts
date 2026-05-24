import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import {
  IdentityProviderPort,
  IdentityTokenSet,
} from '../../ports/identity-provider.port';
import { LoginCommand } from './login.command';

@Injectable()
export class LoginUseCase implements IUseCase<LoginCommand, IdentityTokenSet> {
  constructor(private readonly identityProvider: IdentityProviderPort) {}

  execute(command: LoginCommand): Promise<IdentityTokenSet> {
    return this.identityProvider.login(command.username, command.password);
  }
}
