export interface SocketAuthClaims {
  sub: string;
  [claim: string]: unknown;
}

export abstract class SocketAuthPort {
  abstract verifyAccessToken(token: string): Promise<SocketAuthClaims>;
}
