import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { QuestionTopicNotFoundException } from '../../../domain/exceptions/question.exceptions';
import { QuestionTopicRepository } from '../../../domain/repositories/question-topic.repository';
import { QuestionTopicResult } from '../shared/question-topic.result';
import { UpdateTopicCommand } from './update-topic.command';

@Injectable()
export class UpdateTopicUseCase
  implements IUseCase<UpdateTopicCommand, QuestionTopicResult>
{
  constructor(private readonly topicRepository: QuestionTopicRepository) {}

  async execute(command: UpdateTopicCommand): Promise<QuestionTopicResult> {
    const topic = await this.topicRepository.findById(command.topicId);
    if (!topic) throw new QuestionTopicNotFoundException(command.topicId);

    if (command.parentId) {
      const parentExists = await this.topicRepository.existsById(
        command.parentId,
      );
      if (!parentExists)
        throw new QuestionTopicNotFoundException(command.parentId);
    }

    topic.update({
      name: command.name,
      description: command.description,
      parentId: command.parentId,
    });
    await this.topicRepository.save(topic);
    return QuestionTopicResult.fromAggregate(topic);
  }
}
