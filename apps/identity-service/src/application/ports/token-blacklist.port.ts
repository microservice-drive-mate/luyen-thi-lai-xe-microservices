export abstract class TokenBlacklistPort {
  abstract addToBlacklist(token: string, expiresAt: number): Promise<void>;
  abstract isBlacklisted(token: string): Promise<boolean>;
  abstract removeFromBlacklist(token: string): Promise<void>;
}
