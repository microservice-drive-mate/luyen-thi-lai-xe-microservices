import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { QuestionTopic } from '../../../domain/aggregates/question-topic/question-topic.aggregate';
import { QuestionTopicNotFoundException } from '../../../domain/exceptions/question.exceptions';
import { QuestionTopicRepository } from '../../../domain/repositories/question-topic.repository';
import { QuestionTopicResult } from '../shared/question-topic.result';
import { CreateTopicCommand } from './create-topic.command';

@Injectable()
export class CreateTopicUseCase
  implements IUseCase<CreateTopicCommand, QuestionTopicResult>
{
  constructor(private readonly topicRepository: QuestionTopicRepository) {}

  async execute(command: CreateTopicCommand): Promise<QuestionTopicResult> {
    if (command.parentId) {
      const parentExists = await this.topicRepository.existsById(
        command.parentId,
      );
      if (!parentExists)
        throw new QuestionTopicNotFoundException(command.parentId);
    }
    const topic = QuestionTopic.create({
      id: crypto.randomUUID(),
      name: command.name,
      description: command.description,
      parentId: command.parentId,
    });
    await this.topicRepository.save(topic);
    return QuestionTopicResult.fromAggregate(topic);
  }
}
