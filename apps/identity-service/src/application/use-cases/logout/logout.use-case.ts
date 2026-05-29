import { Injectable, UnauthorizedException } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import * as jwt from 'jsonwebtoken';
import { IdentityProviderPort } from '../../ports/identity-provider.port';
import { TokenBlacklistPort } from '../../ports/token-blacklist.port';
import { LogoutCommand } from './logout.command';
import { LogoutResult } from './logout.result';

@Injectable()
export class LogoutUseCase implements IUseCase<LogoutCommand, LogoutResult> {
  constructor(
    private readonly identityProvider: IdentityProviderPort,
    private readonly tokenBlacklist: TokenBlacklistPort,
  ) {}

  async execute(command: LogoutCommand): Promise<LogoutResult> {
    if (!command.accessToken) {
      throw new UnauthorizedException(
        'Authentication token is missing. (MSG126)',
      );
    }

    const decoded = this.decodeToken(command.accessToken);
    if (!decoded || typeof decoded.exp !== 'number') {
      throw new UnauthorizedException(
        'Authentication token signature is invalid. (MSG127)',
      );
    }

    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp <= now) {
      throw new UnauthorizedException(
        'Authentication token signature is invalid. (MSG127)',
      );
    }

    await this.identityProvider.revokeSession(command.refreshToken);
    await this.tokenBlacklist.addToBlacklist(command.accessToken, decoded.exp);

    return new LogoutResult(
      true,
      'You have been logged out successfully. (MSG122)',
      'Please delete your token from LocalStorage or Cookie',
    );
  }

  private decodeToken(token: string): jwt.JwtPayload | null {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || typeof decoded === 'string') return null;
      return decoded;
    } catch {
      return null;
    }
  }
}
