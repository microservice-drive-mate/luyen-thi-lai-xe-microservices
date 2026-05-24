import { UserRole } from '../../domain/aggregates/identity-user/identity-user.types';

export interface IdentityTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  tokenType: string;
  scope?: string;
}

export interface ExternalIdentityUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
}

export abstract class IdentityProviderPort {
  abstract login(username: string, password: string): Promise<IdentityTokenSet>;
  abstract refreshToken(refreshToken: string): Promise<IdentityTokenSet>;
  abstract revokeSession(refreshToken: string): Promise<void>;
  abstract createUser(
    email: string,
    password: string,
    fullName: string,
  ): Promise<string>;
  abstract updateUser(
    userId: string,
    fields: { email?: string; fullName?: string },
  ): Promise<void>;
  abstract assignRealmRole(userId: string, role: UserRole): Promise<void>;
  abstract setUserEnabled(userId: string, enabled: boolean): Promise<void>;
  abstract findUserByEmail(email: string): Promise<ExternalIdentityUser | null>;
  abstract sendPasswordResetEmail(userId: string): Promise<void>;
}
