import { AuditRequestContext } from '@repo/common';
import { LicenseTier } from '../../../domain/aggregates/user-profile/user-profile.types';

export class AssignLicenseTierCommand {
  constructor(
    readonly studentId: string,
    readonly newLicenseTier: LicenseTier,
    readonly changedById: string,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
