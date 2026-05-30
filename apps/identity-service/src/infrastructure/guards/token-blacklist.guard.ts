import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  CanActivate,
} from '@nestjs/common';
import { TokenBlacklistService } from '../token-blacklist/token-blacklist.service';

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

    return true;
  }
}
