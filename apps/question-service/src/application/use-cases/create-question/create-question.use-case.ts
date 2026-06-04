import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { EventPublisher } from '../../ports/event-publisher.port';
import { Question } from '../../../domain/aggregates/question/question.aggregate';
import {
  QuestionDuplicateException,
  QuestionTopicNotFoundException,
} from '../../../domain/exceptions/question.exceptions';
import { QuestionRepository } from '../../../domain/repositories/question.repository';
import { QuestionTopicRepository } from '../../../domain/repositories/question-topic.repository';
import { QuestionResult } from '../shared/question.result';
import { normalizeQuestionContent } from '../shared/question-signature';
import { CreateQuestionCommand } from './create-question.command';

@Injectable()
export class CreateQuestionUseCase
  implements IUseCase<CreateQuestionCommand, QuestionResult>
{
  constructor(
    private readonly questionRepository: QuestionRepository,
    private readonly topicRepository: QuestionTopicRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: CreateQuestionCommand): Promise<QuestionResult> {
    const topicExists = await this.topicRepository.existsById(command.topicId);
    if (!topicExists) throw new QuestionTopicNotFoundException(command.topicId);

    const isDuplicate = await this.questionRepository.existsBySignature(
      normalizeQuestionContent(command.content),
      command.topicId,
    );
    if (isDuplicate) throw new QuestionDuplicateException();

    const question = Question.create({
      id: crypto.randomUUID(),
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
      createdById: command.createdById,
      options: command.options.map((option) => ({
        id: option.id ?? crypto.randomUUID(),
        content: option.content,
        isCorrect: option.isCorrect,
        displayOrder: option.displayOrder,
      })),
    });

    await this.questionRepository.save(question);
    const events = question.getDomainEvents();
    question.clearDomainEvents();
    await this.eventPublisher.publishAll(events);

    return QuestionResult.fromAggregate(question);
  }
}
