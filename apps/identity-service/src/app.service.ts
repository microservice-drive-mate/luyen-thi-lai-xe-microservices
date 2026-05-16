/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import * as jwt from 'jsonwebtoken';
import { lastValueFrom } from 'rxjs';
import { LoginResponseDto } from './presentation/dtos/login.response.dto';
import { LogoutResponseDto } from './presentation/dtos/logout.response.dto';
import { TokenBlacklistService } from './infrastructure/token-blacklist/token-blacklist.service';
import { KeycloakAdminService } from './infrastructure/keycloak-admin/keycloak-admin.service';
import { ForgotPasswordResponseDto } from './presentation/dtos/forgot-password.response.dto';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly keycloakAdminService: KeycloakAdminService,
  ) {}

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
    } catch (error) {
      const axiosError = error as AxiosError<{ error_description?: string }>;
      const status = axiosError.response?.status;
      const detail =
        axiosError.response?.data?.error_description ?? axiosError.message;
      this.logger.error(
        `Login failed [${status ?? 'NO_RESPONSE'}] → ${detail} | url=${url}`,
      );

      // 401 = sai username/password; mọi lỗi khác (404 realm, 503 Keycloak down...) expose rõ hơn
      if (status === 401) {
        throw new UnauthorizedException(
          'Tài khoản hoặc mật khẩu không chính xác',
        );
      }
      throw new InternalServerErrorException(
        `Keycloak login error [${status ?? 'NO_RESPONSE'}]: ${detail}`,
      );
    }
  }

  /**
   * UC33: Logout - Xóa token khỏi hệ thống
   * @param token JWT token từ Authorization header
   * @returns LogoutResponseDto với thông báo logout thành công
   */
  async logout(
    accessToken: string,
    refreshToken: string,
  ): Promise<LogoutResponseDto> {
    if (!accessToken) {
      throw new UnauthorizedException(
        'Token xác thực bị thiếu hoặc không hợp lệ. (MSG129)',
      );
    }

    const decoded = this.decodeToken(accessToken);
    if (!decoded || typeof decoded.exp !== 'number') {
      throw new UnauthorizedException(
        'Token xác thực bị thiếu hoặc không hợp lệ. (MSG129)',
      );
    }

    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp <= now) {
      throw new UnauthorizedException(
        'Token xác thực bị thiếu hoặc không hợp lệ. (MSG129)',
      );
    }

    // Revoke session trên Keycloak (vô hiệu hóa cả refresh token)
    await this.revokeKeycloakSession(refreshToken);

    // Blacklist access token trong Redis cho đến khi hết hạn
    await this.tokenBlacklistService.addToBlacklist(accessToken, decoded.exp);

    return {
      success: true,
      message: 'Bạn đã đăng xuất thành công. (MSG130)',
      instruction: 'Vui lòng xóa token khỏi LocalStorage hoặc Cookie',
    };
  }

  private async revokeKeycloakSession(refreshToken: string): Promise<void> {
    const authServerUrl = this.configService.getOrThrow<string>(
      'keycloak.authServerUrl',
    );
    const realm = this.configService.getOrThrow<string>('keycloak.realm');
    const clientId = this.configService.getOrThrow<string>('keycloak.clientId');
    const clientSecret = this.configService.getOrThrow<string>(
      'keycloak.clientSecret',
    );

    const url = `${authServerUrl}/realms/${realm}/protocol/openid-connect/logout`;
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('refresh_token', refreshToken);

    try {
      await lastValueFrom(
        this.httpService.post(url, params.toString(), {
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        }),
      );
    } catch (error) {
      const status = (error as AxiosError).response?.status;
      // 400 = refresh token đã bị revoke trước đó hoặc không hợp lệ — vẫn tiếp tục logout
      if (status !== 400) {
        this.logger.warn(
          `Keycloak session revocation failed [${status ?? 'NO_RESPONSE'}]`,
        );
      }
    }
  }

  async refreshToken(refreshToken: string): Promise<LoginResponseDto> {
    const authServerUrl = this.configService.getOrThrow<string>(
      'keycloak.authServerUrl',
    );
    const realm = this.configService.getOrThrow<string>('keycloak.realm');
    const clientId = this.configService.getOrThrow<string>('keycloak.clientId');
    const clientSecret = this.configService.getOrThrow<string>(
      'keycloak.clientSecret',
    );

    const url = `${authServerUrl}/realms/${realm}/protocol/openid-connect/token`;
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('refresh_token', refreshToken);

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
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại',
      );
    }
  }

  async forgotPassword(email: string): Promise<ForgotPasswordResponseDto> {
    const normalizedEmail = email.trim().toLowerCase();
    const genericResponse = {
      success: true,
      message: 'Nếu email này tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.',
    };

    const user =
      await this.keycloakAdminService.findUserByEmail(normalizedEmail);
    if (!user?.id || user.enabled === false) {
      this.logger.log(
        `Forgot password requested for non-existing or disabled email: ${normalizedEmail}`,
      );
      return genericResponse;
    }

    await this.keycloakAdminService.sendPasswordResetEmail(user.id);
    return genericResponse;
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
