import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { EventPublisher } from '../../ports/event-publisher.port';
import { QuestionNotFoundException } from '../../../domain/exceptions/question.exceptions';
import { QuestionRepository } from '../../../domain/repositories/question.repository';
import { QuestionResult } from '../shared/question.result';
import { DeleteQuestionCommand } from './delete-question.command';

@Injectable()
export class DeleteQuestionUseCase
  implements IUseCase<DeleteQuestionCommand, QuestionResult>
{
  constructor(
    private readonly questionRepository: QuestionRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: DeleteQuestionCommand): Promise<QuestionResult> {
    const question = await this.questionRepository.findById(command.questionId);
    if (!question) throw new QuestionNotFoundException(command.questionId);

    question.softDelete(command.deletedById, command.expectedVersion);
    await this.questionRepository.save(question);
    const events = question.getDomainEvents();
    question.clearDomainEvents();
    await this.eventPublisher.publishAll(events);

    return QuestionResult.fromAggregate(question);
  }
}
