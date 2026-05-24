import { AggregateRoot } from '@repo/common';
import { UserCreatedEvent } from '../../events/user-created.event';
import { UserDeletedEvent } from '../../events/user-deleted.event';
import { UserLockedEvent } from '../../events/user-locked.event';
import { UserRoleChangedEvent } from '../../events/user-role-changed.event';
import { UserUpdatedEvent } from '../../events/user-updated.event';
import { IdentityUserAlreadyDeletedException } from '../../exceptions/identity-user-already-deleted.exception';
import { Email } from '../../value-objects/email.vo';
import {
  CreateIdentityUserProps,
  ReconstituteIdentityUserProps,
  UpdateIdentityUserProps,
  UserRole,
} from './identity-user.types';

export class IdentityUser extends AggregateRoot<string> {
  private _email: Email;
  private _fullName: string;
  private _role: UserRole;
  private _isActive: boolean;
  private _isDeleted: boolean;
  private _deletedAt: Date | null;
  private _deletedById: string | null;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: ReconstituteIdentityUserProps) {
    super(props.id);
    this._email = Email.create(props.email);
    this._fullName = props.fullName;
    this._role = props.role;
    this._isActive = props.isActive;
    this._isDeleted = props.isDeleted;
    this._deletedAt = props.deletedAt;
    this._deletedById = props.deletedById;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(props: CreateIdentityUserProps): IdentityUser {
    const now = new Date();
    const user = new IdentityUser({
      ...props,
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      deletedById: null,
      createdAt: now,
      updatedAt: now,
    });
    user.addDomainEvent(
      new UserCreatedEvent(user.id, user.email, user.fullName, user.role),
    );
    return user;
  }

  static reconstitute(props: ReconstituteIdentityUserProps): IdentityUser {
    return new IdentityUser(props);
  }

  update(props: UpdateIdentityUserProps): void {
    this.ensureNotDeleted();
    if (props.email !== undefined) {
      this._email = Email.create(props.email);
    }
    if (props.fullName !== undefined) {
      this._fullName = props.fullName;
    }
    this.touch();
    this.addDomainEvent(
      new UserUpdatedEvent(this.id, this.email, this.fullName),
    );
  }

  changeRole(newRole: UserRole): void {
    this.ensureNotDeleted();
    this._role = newRole;
    this.touch();
    this.addDomainEvent(new UserRoleChangedEvent(this.id, newRole));
  }

  lock(locked: boolean): void {
    this.ensureNotDeleted();
    this._isActive = !locked;
    this.touch();
    this.addDomainEvent(new UserLockedEvent(this.id, locked));
  }

  softDelete(deletedById: string | null): void {
    if (this._isDeleted) return;
    this._isActive = false;
    this._isDeleted = true;
    this._deletedAt = new Date();
    this._deletedById = deletedById;
    this.touch();
    this.addDomainEvent(new UserDeletedEvent(this.id, deletedById));
  }

  private ensureNotDeleted(): void {
    if (this._isDeleted) {
      throw new IdentityUserAlreadyDeletedException(this.id);
    }
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  get email(): string {
    return this._email.value;
  }

  get fullName(): string {
    return this._fullName;
  }

  get role(): UserRole {
    return this._role;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get isDeleted(): boolean {
    return this._isDeleted;
  }

  get deletedAt(): Date | null {
    return this._deletedAt;
  }

  get deletedById(): string | null {
    return this._deletedById;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
