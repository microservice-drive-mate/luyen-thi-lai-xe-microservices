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

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Skip blacklist check if no token is present (AuthGuard will handle missing tokens for non-public routes)
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return true;
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');

    if (token && this.tokenBlacklistService.isBlacklisted(token)) {
      throw new UnauthorizedException(
        'Token has been revoked. Please log in again. (MSG131)',
      );
    }

    return true;
  }
}
