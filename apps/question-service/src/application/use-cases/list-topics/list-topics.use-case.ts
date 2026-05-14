import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { QuestionTopicRepository } from '../../../domain/repositories/question-topic.repository';
import {
  ListQuestionTopicsResult,
  QuestionTopicResult,
} from '../shared/question-topic.result';
import { ListTopicsQuery } from './list-topics.query';

@Injectable()
export class ListTopicsUseCase
  implements IUseCase<ListTopicsQuery, ListQuestionTopicsResult>
{
  constructor(private readonly topicRepository: QuestionTopicRepository) {}

  async execute(query: ListTopicsQuery): Promise<ListQuestionTopicsResult> {
    const page = query.page || 1;
    const size = query.size || 20;
    const result = await this.topicRepository.findAll({
      page,
      size,
      parentId: query.parentId,
    });
    return new ListQuestionTopicsResult(
      result.items.map(QuestionTopicResult.fromAggregate),
      result.total,
      page,
      size,
    );
  }
}
