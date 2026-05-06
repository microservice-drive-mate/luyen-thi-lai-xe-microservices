import { Entity } from '@repo/common';
import { LicenseTier } from './user-profile.types';

export class StudentDetail extends Entity<string> {
  private _licenseTier: LicenseTier | null;
  private _enrolledAt: Date | null;
  private _notes: string | null;

  constructor(
    id: string,
    licenseTier: LicenseTier | null,
    enrolledAt: Date | null,
    notes: string | null,
  ) {
    super(id);
    this._licenseTier = licenseTier;
    this._enrolledAt = enrolledAt;
    this._notes = notes;
  }

  updateLicenseTier(tier: LicenseTier): void {
    this._licenseTier = tier;
  }

  updateNotes(notes: string | null): void {
    this._notes = notes;
  }

  get licenseTier(): LicenseTier | null {
    return this._licenseTier;
  }

  get enrolledAt(): Date | null {
    return this._enrolledAt;
  }

  get notes(): string | null {
    return this._notes;
  }
}
