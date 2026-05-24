import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { META_UNPROTECTED } from 'nest-keycloak-connect';
import * as jwt from 'jsonwebtoken';
import { resilientFetch } from '@repo/common';

interface KeycloakRealmInfo {
  public_key: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private cachedPublicKey: string | null = null;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      META_UNPROTECTED,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: jwt.JwtPayload;
    }>();

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Thiếu hoặc không hợp lệ header Authorization',
      );
    }

    const token = authHeader.slice(7);
    const publicKey = await this.getPublicKey();

    try {
      const authServerUrl = this.configService.getOrThrow<string>(
        'keycloak.authServerUrl',
      );
      const realm = this.configService.getOrThrow<string>('keycloak.realm');
      const issuer = `${authServerUrl}/realms/${realm}`;

      const decoded = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer,
      }) as jwt.JwtPayload;

      request.user = decoded;
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`JWT validation failed: ${message}`);
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
  }

  private async getPublicKey(): Promise<string> {
    if (this.cachedPublicKey) return this.cachedPublicKey;

    const authServerUrl = this.configService.getOrThrow<string>(
      'keycloak.authServerUrl',
    );
    const realm = this.configService.getOrThrow<string>('keycloak.realm');
    const url = `${authServerUrl}/realms/${realm}`;

    try {
      const response = await resilientFetch(
        url,
        {},
        {
          serviceName: 'identity-service',
          dependencyName: 'keycloak',
          timeoutMs:
            this.configService.get<number>('keycloak.timeoutMs') ?? 3_000,
        },
      );
      const data = (await response.json()) as KeycloakRealmInfo;
      const rawKey = data.public_key;
      this.cachedPublicKey = `-----BEGIN PUBLIC KEY-----\n${rawKey}\n-----END PUBLIC KEY-----`;
      return this.cachedPublicKey;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to fetch Keycloak public key: ${message}`);
      throw new UnauthorizedException(
        'Không thể xác thực token: server xác thực không phản hồi',
      );
    }
  }
}
