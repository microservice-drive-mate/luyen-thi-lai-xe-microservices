import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenBlacklistService } from './token-blacklist.service';

interface JwtRevocationPayload {
  sub?: unknown;
  iat?: unknown;
}

@Injectable()
export class TokenBlacklistGuard implements CanActivate {
  constructor(private readonly tokenBlacklistService: TokenBlacklistService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string } }>();

    const authHeader = request.headers.authorization;
    if (!authHeader) return true;

    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token && (await this.tokenBlacklistService.isBlacklisted(token))) {
      throw new UnauthorizedException(
        'Authentication token is missing or invalid. (MSG121)',
      );
    }

    if (token && (await this.isRevokedByUserEpoch(token))) {
      throw new UnauthorizedException(
        'Authentication token is missing or invalid. (MSG121)',
      );
    }

    return true;
  }

  private async isRevokedByUserEpoch(token: string): Promise<boolean> {
    const payload = this.decodePayload(token);
    const userId = typeof payload?.sub === 'string' ? payload.sub : null;
    if (!userId) return false;

    const revokedAfter =
      await this.tokenBlacklistService.getUserRevokedAfter(userId);
    if (revokedAfter === null) return false;

    const issuedAt = typeof payload?.iat === 'number' ? payload.iat : null;
    if (issuedAt === null) return true;
    return issuedAt < revokedAfter;
  }

  private decodePayload(token: string): JwtRevocationPayload | null {
    try {
      const raw = token.startsWith('Bearer ') ? token.slice(7) : token;
      const parts = raw.split('.');
      if (parts.length !== 3) return null;
      const json = Buffer.from(parts[1], 'base64url').toString('utf-8');
      return JSON.parse(json) as JwtRevocationPayload;
    } catch {
      return null;
    }
  }
}
