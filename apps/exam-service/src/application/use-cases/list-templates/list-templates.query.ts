import { LicenseCategory } from '../../../domain/aggregates/exam-template/exam-template.types';

export class ListTemplatesQuery {
  constructor(
    readonly page: number,
    readonly size: number,
    readonly licenseCategory?: LicenseCategory,
    readonly isActive?: boolean,
    readonly includeDeleted?: boolean,
  ) {}
}
