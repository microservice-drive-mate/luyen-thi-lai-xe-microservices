import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { StudentProfileInvalidException } from '../../../domain/exceptions/exam.exceptions';
import { ExamTemplateRepository } from '../../../domain/repositories/exam-template.repository';
import {
  StudentProfile,
  UserProfileClient,
} from '../../ports/user-profile.client';
import { ListAvailableExamsQuery } from './list-available-exams.query';
import {
  AvailableExamResult,
  ListAvailableExamsResult,
} from './list-available-exams.result';

@Injectable()
export class ListAvailableExamsUseCase
  implements IUseCase<ListAvailableExamsQuery, ListAvailableExamsResult>
{
  constructor(
    private readonly templateRepository: ExamTemplateRepository,
    private readonly userProfileClient: UserProfileClient,
  ) {}

  async execute(
    query: ListAvailableExamsQuery,
  ): Promise<ListAvailableExamsResult> {
    const page = Math.max(query.page, 1);
    const size = Math.min(Math.max(query.size, 1), 100);
    let profile: StudentProfile;
    try {
      profile = await this.userProfileClient.getCurrentStudentProfile(
        query.accessToken,
      );
    } catch {
      throw new StudentProfileInvalidException(
        'Unable to validate current student profile',
      );
    }

    if (
      profile.id !== query.studentId ||
      profile.role !== 'STUDENT' ||
      !profile.isActive ||
      !profile.studentDetail
    ) {
      throw new StudentProfileInvalidException(
        'Current user is not an active student',
      );
    }

    const licenseTier = profile.studentDetail.licenseTier;
    if (!licenseTier) {
      return new ListAvailableExamsResult([], 0, page, size);
    }

    const result = await this.templateRepository.findAll({
      page,
      size,
      licenseCategory: licenseTier,
      isActive: true,
      includeDeleted: false,
    });

    return new ListAvailableExamsResult(
      result.items.map(
        (template) =>
          new AvailableExamResult(
            template.id,
            template.name,
            template.description,
            template.licenseCategory,
            template.totalQuestions,
            template.passingScore,
            template.durationMinutes,
            template.criticalQuestions,
            template.maxCriticalMistakes,
            template.shuffleQuestions,
          ),
      ),
      result.total,
      page,
      size,
    );
  }
}
