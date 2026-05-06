import { DomainEvent } from '@repo/common';
import { LicenseTier } from '../aggregates/user-profile/user-profile.types';

export class LicenseTierAssignedEvent extends DomainEvent {
  get eventName(): string {
    return 'user.student.license-assigned';
  }

  constructor(
    readonly studentId: string,
    readonly studentEmail: string,
    readonly studentFullName: string,
    readonly oldLicenseTier: LicenseTier | null,
    readonly newLicenseTier: LicenseTier,
    readonly changedById: string,
  ) {
    super();
  }
}
