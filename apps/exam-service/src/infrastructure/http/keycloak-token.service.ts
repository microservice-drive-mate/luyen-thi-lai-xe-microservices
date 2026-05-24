import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resilientFetch } from '@repo/common';

@Injectable()
export class KeycloakTokenService {
  private cache: { accessToken: string; expiresAt: number } | null = null;

  constructor(private readonly configService: ConfigService) {}

  async getServiceToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.cache && this.cache.expiresAt - now > 10) {
      return this.cache.accessToken;
    }

    const authServerUrl = this.configService.getOrThrow<string>(
      'keycloak.authServerUrl',
    );
    const realm = this.configService.getOrThrow<string>('keycloak.realm');
    const clientId = this.configService.getOrThrow<string>('keycloak.clientId');
    const clientSecret = this.configService.getOrThrow<string>(
      'keycloak.clientSecret',
    );
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    const response = await resilientFetch(
      `${authServerUrl}/realms/${realm}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      },
      {
        serviceName: 'exam-service',
        dependencyName: 'keycloak',
        timeoutMs:
          this.configService.get<number>('keycloak.timeoutMs') ?? 3_000,
      },
    );
    if (!response.ok)
      throw new Error(`Failed to get service token: ${response.status}`);
    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.cache = {
      accessToken: data.access_token,
      expiresAt: now + data.expires_in,
    };
    return data.access_token;
  }
}
