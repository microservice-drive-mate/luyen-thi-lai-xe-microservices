import { LicenseCategory } from '../../../domain/aggregates/exam-template/exam-template.types';

export class CreateTemplateCommand {
  constructor(
    readonly name: string,
    readonly licenseCategory: LicenseCategory,
    readonly totalQuestions: number,
    readonly passingScore: number,
    readonly durationMinutes: number,
    readonly createdById: string,
  ) {}
}
