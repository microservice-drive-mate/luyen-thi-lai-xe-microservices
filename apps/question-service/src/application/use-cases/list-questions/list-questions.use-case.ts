import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { QuestionRepository } from '../../../domain/repositories/question.repository';
import { ListQuestionsResult, QuestionResult } from '../shared/question.result';
import { ListQuestionsQuery } from './list-questions.query';

@Injectable()
export class ListQuestionsUseCase
  implements IUseCase<ListQuestionsQuery, ListQuestionsResult>
{
  constructor(private readonly questionRepository: QuestionRepository) {}

  async execute(query: ListQuestionsQuery): Promise<ListQuestionsResult> {
    const page = query.page || 1;
    const size = query.size || 20;
    const result = await this.questionRepository.findAll({
      page,
      size,
      keyword: query.keyword,
      licenseCategory: query.licenseCategory,
      type: query.type,
      difficulty: query.difficulty,
      topicId: query.topicId,
      isCritical: query.isCritical,
      isActive: query.isActive,
      includeDeleted: query.includeDeleted,
    });
    return new ListQuestionsResult(
      result.items.map(QuestionResult.fromAggregate),
      result.total,
      page,
      size,
    );
  }
}
