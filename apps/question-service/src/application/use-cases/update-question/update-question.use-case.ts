import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { EventPublisher } from '../../ports/event-publisher.port';
import {
  QuestionDuplicateException,
  QuestionNotFoundException,
  QuestionTopicNotFoundException,
} from '../../../domain/exceptions/question.exceptions';
import { QuestionRepository } from '../../../domain/repositories/question.repository';
import { QuestionTopicRepository } from '../../../domain/repositories/question-topic.repository';
import { QuestionResult } from '../shared/question.result';
import { normalizeQuestionContent } from '../shared/question-signature';
import { UpdateQuestionCommand } from './update-question.command';

@Injectable()
export class UpdateQuestionUseCase
  implements IUseCase<UpdateQuestionCommand, QuestionResult>
{
  constructor(
    private readonly questionRepository: QuestionRepository,
    private readonly topicRepository: QuestionTopicRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: UpdateQuestionCommand): Promise<QuestionResult> {
    const question = await this.questionRepository.findById(command.questionId);
    if (!question) throw new QuestionNotFoundException(command.questionId);

    if (command.topicId) {
      const topicExists = await this.topicRepository.existsById(
        command.topicId,
      );
      if (!topicExists)
        throw new QuestionTopicNotFoundException(command.topicId);
    }

    if (command.content || command.topicId) {
      const isDuplicate = await this.questionRepository.existsBySignature(
        normalizeQuestionContent(command.content ?? question.content),
        command.topicId ?? question.topicId,
        question.id,
      );
      if (isDuplicate) throw new QuestionDuplicateException();
    }

    question.update({
      content: command.content,
      type: command.type,
      licenseCategories: command.licenseCategories,
      difficulty: command.difficulty,
      explanation: command.explanation,
      imageUrl: command.imageUrl,
      mediaFileId: command.mediaFileId,
      isCritical: command.isCritical,
      isActive: command.isActive,
      topicId: command.topicId,
      options: command.options?.map((option) => ({
        id: option.id ?? crypto.randomUUID(),
        content: option.content,
        isCorrect: option.isCorrect,
        displayOrder: option.displayOrder,
      })),
      expectedVersion: command.expectedVersion,
    });

    await this.questionRepository.save(question);
    const events = question.getDomainEvents();
    question.clearDomainEvents();
    await this.eventPublisher.publishAll(events);

    return QuestionResult.fromAggregate(question);
  }
}
