import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { QuestionRepository } from '../../../domain/repositories/question.repository';
import { QuestionPoolResult, QuestionResult } from '../shared/question.result';
import { GetQuestionPoolQuery } from './get-question-pool.query';

@Injectable()
export class GetQuestionPoolUseCase
  implements IUseCase<GetQuestionPoolQuery, QuestionPoolResult>
{
  constructor(private readonly questionRepository: QuestionRepository) {}

  async execute(query: GetQuestionPoolQuery): Promise<QuestionPoolResult> {
    const items = await this.questionRepository.getPool({
      licenseCategory: query.licenseCategory,
      size: query.size,
      type: query.type,
      difficulty: query.difficulty,
      topicId: query.topicId,
      isCritical: query.isCritical,
      excludeQuestionIds: query.excludeQuestionIds,
    });
    return new QuestionPoolResult(items.map(QuestionResult.fromAggregate));
  }
}
