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
      throw this.invalidToken();
    }

    const decoded = this.decodeToken(command.accessToken);
    if (!decoded || typeof decoded.exp !== 'number') {
      throw this.invalidToken();
    }

    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp <= now) {
      throw this.invalidToken();
    }

    await this.identityProvider.revokeSession(command.refreshToken);
    await this.tokenBlacklist.addToBlacklist(command.accessToken, decoded.exp);

    return new LogoutResult(
      true,
      'Ban da dang xuat thanh cong. (MSG130)',
      'Vui long xoa token khoi LocalStorage hoac Cookie',
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

  private invalidToken(): UnauthorizedException {
    return new UnauthorizedException(
      'Token xac thuc bi thieu hoac khong hop le. (MSG129)',
    );
  }
}
