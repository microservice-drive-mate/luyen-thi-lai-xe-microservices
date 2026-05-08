import { createHmac } from 'node:crypto';

export type JwtClientName = 'mobile-client' | 'app-client';

export type JwtClientConfig = {
  issuer: JwtClientName;
  secret: string;
};

export const JWT_CLIENTS: Record<JwtClientName, JwtClientConfig> = {
  'mobile-client': {
    issuer: 'mobile-client',
    secret: process.env.JWT_MOBILE_CLIENT_SECRET ?? 'mobile-client-secret',
  },
  'app-client': {
    issuer: 'app-client',
    secret: process.env.JWT_APP_CLIENT_SECRET ?? 'app-client-secret',
  },
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function createJwtAccessToken(payload: {
  issuer: JwtClientName;
  secret: string;
  subject: string;
  email: string;
  name: string;
  client: JwtClientName;
  expiresInSeconds?: number;
}): { token: string; expiresAt: Date } {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresInSeconds = payload.expiresInSeconds ?? 60 * 60 * 24;
  const expiresAt = new Date((issuedAt + expiresInSeconds) * 1000);

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const jwtPayload = {
    iss: payload.issuer,
    sub: payload.subject,
    email: payload.email,
    name: payload.name,
    client: payload.client,
    iat: issuedAt,
    exp: issuedAt + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = createHmac('sha256', payload.secret)
    .update(signingInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return {
    token: `${signingInput}.${signature}`,
    expiresAt,
  };
}
