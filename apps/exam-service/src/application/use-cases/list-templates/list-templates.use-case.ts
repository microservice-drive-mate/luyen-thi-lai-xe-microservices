import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { ExamTemplateRepository } from '../../../domain/repositories/exam-template.repository';
import { ListExamTemplatesResult } from '../shared/exam-template.result';
import { ListTemplatesQuery } from './list-templates.query';

@Injectable()
export class ListTemplatesUseCase
  implements IUseCase<ListTemplatesQuery, ListExamTemplatesResult>
{
  constructor(private readonly templateRepository: ExamTemplateRepository) {}

  async execute(query: ListTemplatesQuery): Promise<ListExamTemplatesResult> {
    const page = Math.max(query.page, 1);
    const size = Math.min(Math.max(query.size, 1), 100);
    const result = await this.templateRepository.findAll({
      ...query,
      page,
      size,
    });
    return new ListExamTemplatesResult(
      result.items.map((item) => ({
        id: item.id,
        name: item.name,
        licenseCategory: item.licenseCategory,
        totalQuestions: item.totalQuestions,
        passingScore: item.passingScore,
        durationMinutes: item.durationMinutes,
        isActive: item.isActive,
        isDeleted: item.isDeleted,
        version: item.version,
        createdById: item.createdById,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      result.total,
      page,
      size,
    );
  }
}
