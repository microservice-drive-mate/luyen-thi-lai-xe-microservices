import { HttpService } from '@nestjs/axios';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { LoginResponseDto } from './login.response.dto';
import { LogoutResponseDto } from './logout.response.dto';
import { TokenBlacklistService } from './infrastructure/token-blacklist/token-blacklist.service';

@Injectable()
export class AppService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly tokenBlacklistService: TokenBlacklistService,
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

  /**
   * UC33: Logout - Xóa token khỏi hệ thống
   * @param token JWT token từ Authorization header
   * @returns LogoutResponseDto với thông báo logout thành công
   */
  async logout(token: string): Promise<LogoutResponseDto> {
    if (!token) {
      throw new UnauthorizedException(
        'Authentication token is missing or invalid. (MSG129)',
      );
    }

    try {
      // Decode JWT token để lấy thông tin exp (expiration time)
      const decoded = this.decodeToken(token);

      if (!decoded || typeof decoded.exp !== 'number') {
        throw new UnauthorizedException(
          'Authentication token is missing or invalid. (MSG129)',
        );
      }

      // Kiểm tra token đã hết hạn hay chưa
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp <= now) {
        throw new UnauthorizedException(
          'Authentication token is missing or invalid. (MSG129)',
        );
      }

      // Thêm token vào blacklist với TTL = exp - now
      this.tokenBlacklistService.addToBlacklist(token, decoded.exp);

      return {
        success: true,
        message: 'You have been logged out successfully. (MSG130)',
        instruction: 'Please delete your token from LocalStorage or Cookie',
      };
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        throw e;
      }
      throw new UnauthorizedException(
        'Authentication token is missing or invalid. (MSG129)',
      );
    }
  }

  /**
   * Decode JWT token (không verify signature, chỉ extract payload)
   * JWT format: header.payload.signature
   */
  /* eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access */
  private decodeToken(token: string): Record<string, number | string> | null {
    try {
      // Remove 'Bearer ' prefix nếu có
      const bearerToken = token.startsWith('Bearer ') ? token.slice(7) : token;

      const parts = bearerToken.split('.');
      if (parts.length !== 3) {
        return null;
      }

      // Decode payload (phần thứ 2)
      const payload = parts[1];
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
      const decoded = JSON.parse(
        Buffer.from(payload, 'base64').toString('utf-8'),
      );

      return decoded as Record<string, number | string>;
    } catch {
      // JWT decode failed, return null
      return null;
    }
  }
}
