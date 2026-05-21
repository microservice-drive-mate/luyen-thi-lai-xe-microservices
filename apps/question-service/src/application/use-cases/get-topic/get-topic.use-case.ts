import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { QuestionTopicNotFoundException } from '../../../domain/exceptions/question.exceptions';
import { QuestionTopicRepository } from '../../../domain/repositories/question-topic.repository';
import { QuestionTopicResult } from '../shared/question-topic.result';
import { GetTopicQuery } from './get-topic.query';

@Injectable()
export class GetTopicUseCase
  implements IUseCase<GetTopicQuery, QuestionTopicResult>
{
  constructor(private readonly topicRepository: QuestionTopicRepository) {}

  async execute(query: GetTopicQuery): Promise<QuestionTopicResult> {
    const topic = await this.topicRepository.findById(query.topicId);
    if (!topic) throw new QuestionTopicNotFoundException(query.topicId);
    return QuestionTopicResult.fromAggregate(topic);
  }
}
