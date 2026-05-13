import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

interface AdminTokenCache {
  accessToken: string;
  expiresAt: number; // unix seconds
}

interface KeycloakRoleRepresentation {
  id: string;
  name: string;
}

@Injectable()
export class KeycloakAdminService {
  private readonly logger = new Logger(KeycloakAdminService.name);
  private adminTokenCache: AdminTokenCache | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Public Methods ───────────────────────────────────────────────────────

  /**
   * Tạo user mới trong Keycloak. Trả về keycloakUserId.
   * Credential được đặt là temporary (user phải đổi mật khẩu lần đầu login).
   */
  async createUser(email: string, temporaryPassword: string): Promise<string> {
    const token = await this.getAdminToken();
    const url = `${this.adminBaseUrl}/users`;

    try {
      const response = await lastValueFrom(
        this.httpService.post(
          url,
          {
            username: email,
            email,
            enabled: true,
            credentials: [
              { type: 'password', value: temporaryPassword, temporary: true },
            ],
          },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );

      // Keycloak trả 201 Created với Location: .../users/{id}
      const location = response.headers.location as string | undefined;
      if (!location) {
        throw new InternalServerErrorException(
          'Keycloak did not return user location header',
        );
      }
      return location.split('/').at(-1) as string;
    } catch (error) {
      this.handleKeycloakError(error, 'createUser');
    }
  }

  /**
   * Gán realm role cho user (replace toàn bộ roles hiện tại).
   * Gồm 2 bước: lấy role representation → assign.
   */
  async assignRealmRole(userId: string, roleName: string): Promise<void> {
    const token = await this.getAdminToken();
    const role = await this.getRealmRole(roleName, token);

    const url = `${this.adminBaseUrl}/users/${userId}/role-mappings/realm`;
    try {
      await lastValueFrom(
        this.httpService.post(url, [role], {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      this.logger.log(`Assigned role ${roleName} to user ${userId}`);
    } catch (error) {
      this.handleKeycloakError(error, 'assignRealmRole');
    }
  }

  /**
   * Enable / disable user account trong Keycloak.
   */
  async setUserEnabled(userId: string, enabled: boolean): Promise<void> {
    const token = await this.getAdminToken();
    const url = `${this.adminBaseUrl}/users/${userId}`;

    try {
      await lastValueFrom(
        this.httpService.put(
          url,
          { enabled },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      this.logger.log(`Set user ${userId} enabled=${enabled}`);
    } catch (error) {
      this.handleKeycloakError(error, 'setUserEnabled');
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private get adminBaseUrl(): string {
    const authServerUrl = this.configService.getOrThrow<string>(
      'keycloak.authServerUrl',
    );
    const realm = this.configService.getOrThrow<string>('keycloak.realm');
    return `${authServerUrl}/admin/realms/${realm}`;
  }

  /**
   * Lấy admin access token qua Client Credentials Grant.
   * Cache token trong memory, refresh khi còn < 10 giây.
   *
   * Yêu cầu: client `nestjs-backend` phải có Service Accounts Enabled
   * và service account role: realm-management > manage-users + view-realm.
   */
  private async getAdminToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.adminTokenCache && this.adminTokenCache.expiresAt - now > 10) {
      return this.adminTokenCache.accessToken;
    }

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
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    try {
      const response = await lastValueFrom(
        this.httpService.post(url, params.toString(), {
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        }),
      );

      const data = response.data as {
        access_token: string;
        expires_in: number;
      };
      this.adminTokenCache = {
        accessToken: data.access_token,
        expiresAt: now + data.expires_in,
      };
      return this.adminTokenCache.accessToken;
    } catch {
      throw new InternalServerErrorException(
        'Failed to obtain Keycloak admin token',
      );
    }
  }

  private async getRealmRole(
    roleName: string,
    token: string,
  ): Promise<KeycloakRoleRepresentation> {
    const url = `${this.adminBaseUrl}/roles/${roleName}`;
    try {
      const response = await lastValueFrom(
        this.httpService.get<KeycloakRoleRepresentation>(url, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      return response.data;
    } catch {
      throw new BadRequestException(
        `Role '${roleName}' not found in Keycloak realm`,
      );
    }
  }

  private handleKeycloakError(error: unknown, operation: string): never {
    const axiosError = error as AxiosError<{ errorMessage?: string }>;
    const status = axiosError.response?.status;
    const message =
      axiosError.response?.data?.errorMessage ?? axiosError.message;

    this.logger.error(`Keycloak ${operation} failed [${status}]: ${message}`);

    if (status === 409) {
      throw new BadRequestException(
        'User with this email already exists in Keycloak',
      );
    }
    if (status === 400) {
      throw new BadRequestException(`Invalid request to Keycloak: ${message}`);
    }
    throw new InternalServerErrorException(`Keycloak ${operation} failed`);
  }
}
