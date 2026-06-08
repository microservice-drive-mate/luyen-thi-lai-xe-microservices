import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resilientFetch, TokenBlacklistService } from '@repo/common';
import * as jwt from 'jsonwebtoken';
import {
  SocketAuthClaims,
  SocketAuthPort,
} from '../../application/ports/socket-auth.port';

interface KeycloakRealmInfo {
  public_key?: string;
}

@Injectable()
export class KeycloakJwtVerifierService extends SocketAuthPort {
  private readonly logger = new Logger(KeycloakJwtVerifierService.name);
  private cachedPublicKey: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {
    super();
  }

  async verifyAccessToken(token: string): Promise<SocketAuthClaims> {
    if (await this.tokenBlacklistService.isBlacklisted(token)) {
      throw new UnauthorizedException('Authentication token is revoked.');
    }

    const publicKey = await this.getPublicKey();
    const authServerUrl = this.configService.getOrThrow<string>(
      'keycloak.authServerUrl',
    );
    const realm = this.configService.getOrThrow<string>('keycloak.realm');
    const issuer = `${authServerUrl}/realms/${realm}`;

    try {
      const decoded = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer,
      });

      if (!decoded || typeof decoded === 'string') {
        throw new UnauthorizedException('Invalid JWT payload.');
      }
      if (!decoded.sub) {
        throw new UnauthorizedException('JWT subject is missing.');
      }

      return {
        ...decoded,
        sub: decoded.sub,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      const message =
        error instanceof Error ? error.message : 'Unknown JWT validation error';
      this.logger.warn(`Socket JWT validation failed: ${message}`);
      throw new UnauthorizedException('Authentication token is invalid.');
    }
  }

  private async getPublicKey(): Promise<string> {
    if (this.cachedPublicKey) return this.cachedPublicKey;

    const authServerUrl = this.configService.getOrThrow<string>(
      'keycloak.authServerUrl',
    );
    const realm = this.configService.getOrThrow<string>('keycloak.realm');
    const url = `${authServerUrl}/realms/${realm}`;

    const response = await resilientFetch(
      url,
      {},
      {
        serviceName: 'notification-service',
        dependencyName: 'keycloak',
        timeoutMs: this.configService.get<number>('keycloak.timeoutMs') ?? 3000,
      },
    );
    const data = (await response.json()) as KeycloakRealmInfo;

    if (!data.public_key) {
      throw new UnauthorizedException('Keycloak public key is missing.');
    }

    this.cachedPublicKey = `-----BEGIN PUBLIC KEY-----\n${data.public_key}\n-----END PUBLIC KEY-----`;
    return this.cachedPublicKey;
  }
}
