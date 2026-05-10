import { HttpService } from '@nestjs/axios';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { LoginResponseDto } from './login.response.dto';

@Injectable()
export class AppService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async login(username: string, password: string): Promise<LoginResponseDto> {
    const authServerUrl = this.configService.getOrThrow<string>(
      'keycloak.authServerUrl',
    );
    const realm = this.configService.getOrThrow<string>('keycloak.realm');
    const clientId = this.configService.getOrThrow<string>('keycloak.clientId');
    const clientSecret = this.configService.getOrThrow<string>(
      'keycloak.clientSecret',
    );

    const url = `${authServerUrl}/realms/${realm}/protocol/openid-connect/token`;

    // Keycloak yêu cầu format x-www-form-urlencoded
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('username', username);
    params.append('password', password);

    try {
      const response = await lastValueFrom(
        this.httpService.post(url, params.toString(), {
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        }),
      );
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        refreshExpiresIn: response.data.refresh_expires_in,
        tokenType: response.data.token_type,
        scope: response.data.scope,
      };
    } catch (e) {
      throw new UnauthorizedException(
        'Tài khoản hoặc mật khẩu không chính xác',
      );
    }
  }
}
