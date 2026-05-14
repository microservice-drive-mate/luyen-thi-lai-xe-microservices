import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { QuestionNotFoundException } from '../../../domain/exceptions/question.exceptions';
import { QuestionRepository } from '../../../domain/repositories/question.repository';
import { QuestionResult } from '../shared/question.result';
import { GetQuestionQuery } from './get-question.query';

@Injectable()
export class GetQuestionUseCase
  implements IUseCase<GetQuestionQuery, QuestionResult>
{
  constructor(private readonly questionRepository: QuestionRepository) {}

  async execute(query: GetQuestionQuery): Promise<QuestionResult> {
    const question = await this.questionRepository.findById(query.questionId);
    if (!question) throw new QuestionNotFoundException(query.questionId);
    return QuestionResult.fromAggregate(question);
  }
}
