import { LicenseTierAssignedEvent } from '../../events/license-tier-assigned.event';
import { UserProfile } from './user-profile.aggregate';
import { LicenseTier, UserRole } from './user-profile.types';

describe('UserProfile', () => {
  it('creates student detail with an application-provided id', () => {
    const profile = UserProfile.create({
      id: 'user-1',
      studentDetailId: 'student-detail-1',
      fullName: 'Nguyen Van A',
      email: 'student@example.com',
      role: UserRole.STUDENT,
      licenseTier: LicenseTier.B2,
    });

    expect(profile.studentDetail?.id).toBe('student-detail-1');
    expect(profile.studentDetail?.licenseTier).toBe(LicenseTier.B2);
  });

  it('requires a student detail id when creating student profiles', () => {
    expect(() =>
      UserProfile.create({
        id: 'user-1',
        fullName: 'Nguyen Van A',
        email: 'student@example.com',
        role: UserRole.STUDENT,
      }),
    ).toThrow('Student detail id is required');
  });

  it('assigns license tier and records audit/domain event', () => {
    const profile = UserProfile.create({
      id: 'user-1',
      studentDetailId: 'student-detail-1',
      fullName: 'Nguyen Van A',
      email: 'student@example.com',
      role: UserRole.STUDENT,
    });

    profile.assignLicenseTier(LicenseTier.A1, 'admin-1');

    expect(profile.studentDetail?.licenseTier).toBe(LicenseTier.A1);
    expect(profile.pendingAuditEntry).toMatchObject({
      oldLicenseTier: null,
      newLicenseTier: LicenseTier.A1,
      changedById: 'admin-1',
    });
    expect(profile.getDomainEvents()).toEqual([
      expect.any(LicenseTierAssignedEvent),
    ]);
  });
});
