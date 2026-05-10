import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

type JwtPayload = {
  sub?: string;
  realm_access?: {
    roles?: string[];
  };
  resource_access?: Record<string, { roles?: string[] }>;
};

@Injectable()
export class AuthContextMiddleware implements NestMiddleware {
  use(request: Request, _response: Response, next: NextFunction): void {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authorization.slice('Bearer '.length).trim();
    const payload = this.decodeJwtPayload(token);

    if (payload?.sub) {
      request.headers['x-user-id'] = payload.sub;
    }

    const role = this.resolvePrimaryRole(payload);
    if (role) {
      request.headers['x-user-role'] = role;
    }

    next();
  }

  private decodeJwtPayload(token: string): JwtPayload | null {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }

    try {
      const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
      return JSON.parse(payloadJson) as JwtPayload;
    } catch {
      return null;
    }
  }

  private resolvePrimaryRole(payload: JwtPayload | null): string | null {
    if (!payload) {
      return null;
    }

    const realmRole = payload.realm_access?.roles?.[0];
    if (realmRole) {
      return realmRole;
    }

    for (const resource of Object.values(payload.resource_access ?? {})) {
      const role = resource.roles?.[0];
      if (role) {
        return role;
      }
    }

    return null;
  }
}
