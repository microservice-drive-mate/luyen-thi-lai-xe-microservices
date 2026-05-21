import { LicenseCategory } from '../../../domain/aggregates/exam-template/exam-template.types';

export class AvailableExamResult {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly description: string | null,
    readonly licenseCategory: LicenseCategory,
    readonly totalQuestions: number,
    readonly passingScore: number,
    readonly durationMinutes: number,
    readonly criticalQuestions: number,
    readonly maxCriticalMistakes: number,
    readonly shuffleQuestions: boolean,
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
