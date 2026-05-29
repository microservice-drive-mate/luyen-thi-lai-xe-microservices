import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';
import { configureAxiosResilience } from '@repo/common';
import {
  ExternalIdentityUser,
  IdentityProviderPort,
  IdentityTokenSet,
} from '../../application/ports/identity-provider.port';
import { UserRole } from '../../domain/aggregates/identity-user/identity-user.types';

interface AdminTokenCache {
  accessToken: string;
  expiresAt: number; // unix seconds
}

interface KeycloakRoleRepresentation {
  id: string;
  name: string;
}

interface KeycloakUserRepresentation {
  id: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
}

type KeycloakErrorBody =
  | string
  | {
      error?: string;
      error_description?: string;
      errorMessage?: string;
      message?: string;
    };

@Injectable()
export class KeycloakAdminService extends IdentityProviderPort {
  private readonly logger = new Logger(KeycloakAdminService.name);
  private adminTokenCache: AdminTokenCache | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    super();
    configureAxiosResilience(this.httpService.axiosRef, {
      serviceName: 'identity-service',
      dependencyName: 'keycloak',
      timeoutMs: this.configService.get<number>('keycloak.timeoutMs') ?? 3_000,
    });
  }

  // ─── Public Methods ───────────────────────────────────────────────────────

  /**
   * Tạo user mới trong Keycloak. Trả về keycloakUserId.
   * Credential được đặt permanent để user có thể login ngay bằng password grant.
   */
  async createUser(
    email: string,
    password: string,
    fullName: string,
  ): Promise<string> {
    const token = await this.getAdminToken();
    const url = `${this.adminBaseUrl}/users`;
    const nameParts = this.splitFullName(fullName);

    try {
      const response = await lastValueFrom(
        this.httpService.post(
          url,
          {
            username: email,
            email,
            firstName: nameParts.firstName,
            lastName: nameParts.lastName,
            enabled: true,
            emailVerified: true,
            requiredActions: [],
            credentials: [
              { type: 'password', value: password, temporary: false },
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

  async login(username: string, password: string): Promise<IdentityTokenSet> {
    const url = this.tokenEndpoint;
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    params.append('username', username);
    params.append('password', password);

    try {
      const response = await lastValueFrom(
        this.httpService.post(url, params.toString(), {
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        }),
      );
      return this.toTokenSet(response.data);
    } catch (error) {
      const axiosError = error as AxiosError<{ error_description?: string }>;
      const status = axiosError.response?.status;
      const detail =
        axiosError.response?.data?.error_description ?? axiosError.message;
      this.logger.error(
        `Login failed [${status ?? 'NO_RESPONSE'}] -> ${detail} | url=${url}`,
      );

      if (status === 401) {
        throw new UnauthorizedException('Invalid email or password. (MSG03)');
      }
      throw new InternalServerErrorException(
        `Keycloak login error [${status ?? 'NO_RESPONSE'}]: ${detail}`,
      );
    }
  }

  async refreshToken(refreshToken: string): Promise<IdentityTokenSet> {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    params.append('refresh_token', refreshToken);

    try {
      const response = await lastValueFrom(
        this.httpService.post(this.tokenEndpoint, params.toString(), {
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        }),
      );
      return this.toTokenSet(response.data);
    } catch {
      throw new UnauthorizedException(
        'Refresh token khong hop le hoac da het han. Vui long dang nhap lai',
      );
    }
  }

  async revokeSession(refreshToken: string): Promise<void> {
    const url = `${this.realmBaseUrl}/protocol/openid-connect/logout`;
    const params = new URLSearchParams();
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    params.append('refresh_token', refreshToken);

    try {
      await lastValueFrom(
        this.httpService.post(url, params.toString(), {
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        }),
      );
    } catch (error) {
      const status = (error as AxiosError).response?.status;
      if (status !== 400) {
        this.logger.warn(
          `Keycloak session revocation failed [${status ?? 'NO_RESPONSE'}]`,
        );
      }
    }
  }

  async getUser(userId: string): Promise<KeycloakUserRepresentation> {
    const token = await this.getAdminToken();
    const url = `${this.adminBaseUrl}/users/${userId}`;

    try {
      const response = await lastValueFrom(
        this.httpService.get<KeycloakUserRepresentation>(url, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      return response.data;
    } catch (error) {
      this.handleKeycloakError(error, 'getUser');
    }
  }

  async updateUser(
    userId: string,
    fields: { email?: string; fullName?: string },
  ): Promise<void> {
    const token = await this.getAdminToken();
    const existing = await this.getUser(userId);
    const url = `${this.adminBaseUrl}/users/${userId}`;
    const email = fields.email ?? existing.email;
    const fullName = fields.fullName ?? this.joinName(existing);
    const nameParts = this.splitFullName(fullName);

    try {
      await lastValueFrom(
        this.httpService.put(
          url,
          {
            ...existing,
            username: email,
            email,
            firstName: nameParts.firstName,
            lastName: nameParts.lastName,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      this.logger.log(`Updated Keycloak user ${userId}`);
    } catch (error) {
      this.handleKeycloakError(error, 'updateUser');
    }
  }

  /**
   * Gán realm role cho user (replace toàn bộ roles hiện tại).
   * Gồm 2 bước: lấy role representation → assign.
   */
  async assignRealmRole(userId: string, roleName: UserRole): Promise<void> {
    const token = await this.getAdminToken();
    const role = await this.getRealmRole(roleName, token);
    const currentRoles = await this.getUserRealmRoles(userId, token);
    const managedRoles = currentRoles.filter((r) =>
      ['ADMIN', 'CENTER_MANAGER', 'INSTRUCTOR', 'STUDENT'].includes(r.name),
    );

    const url = `${this.adminBaseUrl}/users/${userId}/role-mappings/realm`;
    try {
      if (managedRoles.length > 0) {
        await lastValueFrom(
          this.httpService.delete(url, {
            headers: { Authorization: `Bearer ${token}` },
            data: managedRoles,
          }),
        );
      }
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

  async findUserByEmail(email: string): Promise<ExternalIdentityUser | null> {
    const token = await this.getAdminToken();
    const url = `${this.adminBaseUrl}/users`;

    try {
      const response = await lastValueFrom(
        this.httpService.get<KeycloakUserRepresentation[]>(url, {
          headers: { Authorization: `Bearer ${token}` },
          params: { email, exact: true },
        }),
      );
      return response.data[0] ?? null;
    } catch (error) {
      this.handleKeycloakError(error, 'findUserByEmail');
    }
  }

  async sendPasswordResetEmail(userId: string): Promise<void> {
    const token = await this.getAdminToken();
    const clientId = this.configService.getOrThrow<string>('keycloak.clientId');
    const url = `${this.adminBaseUrl}/users/${userId}/execute-actions-email`;

    try {
      this.logger.log(
        `Requesting Keycloak password reset email for user=${userId} client=${clientId} lifespan=900`,
      );
      const response = await lastValueFrom(
        this.httpService.put(url, ['UPDATE_PASSWORD'], {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            client_id: clientId,
            lifespan: 900,
          },
        }),
      );
      this.logger.log(
        `Keycloak accepted password reset email request for user=${userId} status=${response.status}`,
      );
    } catch (error) {
      this.handleKeycloakError(error, 'sendPasswordResetEmail');
    }
  }

  private get adminBaseUrl(): string {
    const authServerUrl = this.configService.getOrThrow<string>(
      'keycloak.authServerUrl',
    );
    const realm = this.configService.getOrThrow<string>('keycloak.realm');
    return `${authServerUrl}/admin/realms/${realm}`;
  }

  private get realmBaseUrl(): string {
    const authServerUrl = this.configService.getOrThrow<string>(
      'keycloak.authServerUrl',
    );
    const realm = this.configService.getOrThrow<string>('keycloak.realm');
    return `${authServerUrl}/realms/${realm}`;
  }

  private get tokenEndpoint(): string {
    return `${this.realmBaseUrl}/protocol/openid-connect/token`;
  }

  private get clientId(): string {
    return this.configService.getOrThrow<string>('keycloak.clientId');
  }

  private get clientSecret(): string {
    return this.configService.getOrThrow<string>('keycloak.clientSecret');
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

  private toTokenSet(data: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    refresh_expires_in: number;
    token_type: string;
    scope?: string;
  }): IdentityTokenSet {
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      refreshExpiresIn: data.refresh_expires_in,
      tokenType: data.token_type,
      scope: data.scope,
    };
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

  private async getUserRealmRoles(
    userId: string,
    token: string,
  ): Promise<KeycloakRoleRepresentation[]> {
    const url = `${this.adminBaseUrl}/users/${userId}/role-mappings/realm`;
    try {
      const response = await lastValueFrom(
        this.httpService.get<KeycloakRoleRepresentation[]>(url, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      return response.data;
    } catch (error) {
      this.handleKeycloakError(error, 'getUserRealmRoles');
    }
  }

  private joinName(user: KeycloakUserRepresentation): string {
    return [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  }

  private splitFullName(fullName: string): {
    firstName: string;
    lastName: string;
  } {
    const normalized = fullName.trim().replace(/\s+/g, ' ');
    const parts = normalized.split(' ');
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    }

    return {
      firstName: parts.slice(0, -1).join(' '),
      lastName: parts.at(-1) ?? '',
    };
  }

  private handleKeycloakError(error: unknown, operation: string): never {
    const axiosError = error as AxiosError<KeycloakErrorBody>;
    const status = axiosError.response?.status;
    const message = this.getKeycloakErrorMessage(axiosError);
    const responseBody = this.stringifyResponseBody(axiosError.response);

    this.logger.error(
      `Keycloak ${operation} failed [${status ?? 'NO_RESPONSE'}]: ${message}`,
    );
    if (responseBody) {
      this.logger.error(`Keycloak ${operation} response body: ${responseBody}`);
    }

    if (status === 409) {
      throw new BadRequestException('Email already exists. (MSG10)');
    }
    if (status === 404) {
      throw new BadRequestException('User not found in Keycloak');
    }
    if (status === 400) {
      throw new BadRequestException(`Invalid request to Keycloak: ${message}`);
    }
    throw new InternalServerErrorException(`Keycloak ${operation} failed`);
  }

  private getKeycloakErrorMessage(
    error: AxiosError<KeycloakErrorBody>,
  ): string {
    const body = error.response?.data;
    if (typeof body === 'string') return body;
    return (
      body?.errorMessage ??
      body?.error_description ??
      body?.message ??
      body?.error ??
      error.message
    );
  }

  private stringifyResponseBody(
    response: AxiosResponse<KeycloakErrorBody> | undefined,
  ): string | null {
    if (!response?.data) return null;
    if (typeof response.data === 'string') return response.data;
    return JSON.stringify(response.data);
  }
}
