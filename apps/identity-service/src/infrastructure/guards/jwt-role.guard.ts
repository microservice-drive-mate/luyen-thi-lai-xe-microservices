import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleMatchingMode, META_ROLES } from 'nest-keycloak-connect';
import type { JwtPayload } from 'jsonwebtoken';

interface RolesOption {
  roles: string[];
  mode?: RoleMatchingMode;
}

interface RequestWithUser {
  user?: JwtPayload & {
    realm_access?: { roles: string[] };
  };
}

@Injectable()
export class JwtRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesMetadata = this.reflector.getAllAndOverride<RolesOption>(
      META_ROLES,
      [context.getHandler(), context.getClass()],
    );

    if (!rolesMetadata?.roles?.length) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) return false;

    const realmRoles = user.realm_access?.roles ?? [];
    const required = rolesMetadata.roles.map((r) =>
      r.startsWith('realm:') ? r.slice(6) : r,
    );

    const mode = rolesMetadata.mode ?? RoleMatchingMode.ANY;
    const hasRole =
      mode === RoleMatchingMode.ALL
        ? required.every((r) => realmRoles.includes(r))
        : required.some((r) => realmRoles.includes(r));

    if (!hasRole) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
