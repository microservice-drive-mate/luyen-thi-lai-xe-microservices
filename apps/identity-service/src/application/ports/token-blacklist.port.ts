export abstract class TokenBlacklistPort {
  abstract addToBlacklist(token: string, expiresAt: number): Promise<void>;
  abstract isBlacklisted(token: string): Promise<boolean>;
  abstract removeFromBlacklist(token: string): Promise<void>;
  abstract revokeUserTokensIssuedBefore(
    userId: string,
    issuedBefore: number,
  ): Promise<void>;
  abstract getUserRevokedAfter(userId: string): Promise<number | null>;
}
