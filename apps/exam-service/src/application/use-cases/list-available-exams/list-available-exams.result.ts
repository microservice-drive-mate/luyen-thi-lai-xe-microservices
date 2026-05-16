import { LicenseCategory } from '../../../domain/aggregates/exam-template/exam-template.types';

export class AvailableExamResult {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly licenseCategory: LicenseCategory,
    readonly totalQuestions: number,
    readonly passingScore: number,
    readonly durationMinutes: number,
  ) {}
}

export class ListAvailableExamsResult {
  constructor(
    readonly items: AvailableExamResult[],
    readonly total: number,
    readonly page: number,
    readonly size: number,
  ) {}
}
