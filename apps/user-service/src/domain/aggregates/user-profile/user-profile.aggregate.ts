import { AggregateRoot } from '@repo/common';
import { StudentDetail } from './student-detail.entity';
import { LicenseTierAssignedEvent } from '../../events/license-tier-assigned.event';
import { UserNotStudentException } from '../../exceptions/user-not-student.exception';
import {
  CreateUserProfileProps,
  Gender,
  LicenseAuditEntry,
  LicenseTier,
  ReconstituteUserProfileProps,
  UpdateUserProfileProps,
  UserRole,
} from './user-profile.types';

export class UserProfile extends AggregateRoot<string> {
  private _fullName: string;
  private _email: string;
  private _phoneNumber: string | null;
  private _dateOfBirth: Date | null;
  private _avatarUrl: string | null;
  private _gender: Gender | null;
  private _address: string | null;
  private _role: UserRole;
  private _isActive: boolean;
  private _createdAt: Date;
  private _studentDetail: StudentDetail | null;
  private _pendingAuditEntry: LicenseAuditEntry | null = null;

  private constructor(
    id: string,
    fullName: string,
    email: string,
    phoneNumber: string | null,
    dateOfBirth: Date | null,
    avatarUrl: string | null,
    gender: Gender | null,
    address: string | null,
    role: UserRole,
    isActive: boolean,
    createdAt: Date,
    studentDetail: StudentDetail | null,
  ) {
    super(id);
    this._fullName = fullName;
    this._email = email;
    this._phoneNumber = phoneNumber;
    this._dateOfBirth = dateOfBirth;
    this._avatarUrl = avatarUrl;
    this._gender = gender;
    this._address = address;
    this._role = role;
    this._isActive = isActive;
    this._createdAt = createdAt;
    this._studentDetail = studentDetail;
  }

  static create(props: CreateUserProfileProps): UserProfile {
    const studentDetail =
      props.role === UserRole.STUDENT
        ? new StudentDetail(
            crypto.randomUUID(),
            null,
            props.enrolledAt ?? null,
            null,
          )
        : null;

    return new UserProfile(
      props.id,
      props.fullName,
      props.email,
      props.phoneNumber ?? null,
      props.dateOfBirth ?? null,
      props.avatarUrl ?? null,
      props.gender ?? null,
      props.address ?? null,
      props.role,
      true,
      new Date(),
      studentDetail,
    );
  }

  static reconstitute(props: ReconstituteUserProfileProps): UserProfile {
    const studentDetail = props.studentDetail
      ? new StudentDetail(
          props.studentDetail.id,
          props.studentDetail.licenseTier,
          props.studentDetail.enrolledAt,
          props.studentDetail.notes,
        )
      : null;

    return new UserProfile(
      props.id,
      props.fullName,
      props.email,
      props.phoneNumber,
      props.dateOfBirth,
      props.avatarUrl,
      props.gender,
      props.address,
      props.role,
      props.isActive,
      props.createdAt,
      studentDetail,
    );
  }

  update(props: UpdateUserProfileProps): void {
    if (props.fullName !== undefined) this._fullName = props.fullName;
    if (props.phoneNumber !== undefined) this._phoneNumber = props.phoneNumber;
    if (props.dateOfBirth !== undefined) this._dateOfBirth = props.dateOfBirth;
    if (props.avatarUrl !== undefined) this._avatarUrl = props.avatarUrl;
    if (props.gender !== undefined) this._gender = props.gender;
    if (props.address !== undefined) this._address = props.address;
    if (props.notes !== undefined && this._studentDetail) {
      this._studentDetail.updateNotes(props.notes);
    }
  }

  deactivate(): void {
    this._isActive = false;
  }

  activate(): void {
    this._isActive = true;
  }

  syncRole(newRole: UserRole): void {
    const wasStudent = this._role === UserRole.STUDENT;
    const becomesStudent = newRole === UserRole.STUDENT;
    this._role = newRole;

    if (!wasStudent && becomesStudent && !this._studentDetail) {
      this._studentDetail = new StudentDetail(
        crypto.randomUUID(),
        null,
        null,
        null,
      );
    }
    if (wasStudent && !becomesStudent) {
      this._studentDetail = null;
    }
  }

  assignLicenseTier(newTier: LicenseTier, changedById: string): void {
    if (this._role !== UserRole.STUDENT) {
      throw new UserNotStudentException();
    }
    if (!this._studentDetail) {
      this._studentDetail = new StudentDetail(
        crypto.randomUUID(),
        null,
        null,
        null,
      );
    }

    const oldTier = this._studentDetail.licenseTier;
    this._studentDetail.updateLicenseTier(newTier);

    this._pendingAuditEntry = {
      oldLicenseTier: oldTier,
      newLicenseTier: newTier,
      changedById,
      changedAt: new Date(),
    };

    this.addDomainEvent(
      new LicenseTierAssignedEvent(
        this.id,
        this._email,
        this._fullName,
        oldTier,
        newTier,
        changedById,
      ),
    );
  }

  get fullName(): string {
    return this._fullName;
  }
  get email(): string {
    return this._email;
  }
  get phoneNumber(): string | null {
    return this._phoneNumber;
  }
  get dateOfBirth(): Date | null {
    return this._dateOfBirth;
  }
  get avatarUrl(): string | null {
    return this._avatarUrl;
  }
  get gender(): Gender | null {
    return this._gender;
  }
  get address(): string | null {
    return this._address;
  }
  get role(): UserRole {
    return this._role;
  }
  get isActive(): boolean {
    return this._isActive;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get studentDetail(): StudentDetail | null {
    return this._studentDetail;
  }
  get pendingAuditEntry(): LicenseAuditEntry | null {
    return this._pendingAuditEntry;
  }

  clearPendingAuditEntry(): void {
    this._pendingAuditEntry = null;
  }
}
