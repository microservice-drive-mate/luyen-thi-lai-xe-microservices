import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { ExamSessionNotFoundException } from '../../../domain/exceptions/exam.exceptions';
import { ExamSessionRepository } from '../../../domain/repositories/exam-session.repository';
import { ExamSessionResult } from '../shared/exam-session.result';
import { SaveAnswerCommand } from './save-answer.command';

@Injectable()
export class SaveAnswerUseCase
  implements IUseCase<SaveAnswerCommand, ExamSessionResult>
{
  constructor(private readonly sessionRepository: ExamSessionRepository) {}

  async execute(command: SaveAnswerCommand): Promise<ExamSessionResult> {
    const session = await this.sessionRepository.findById(command.sessionId);
    if (!session) throw new ExamSessionNotFoundException(command.sessionId);
    session.assertOwner(command.studentId);
    session.saveAnswer(
      command.questionId,
      command.selectedOptionId,
      command.isBookmarked,
    );
    await this.sessionRepository.save(session);
    return ExamSessionResult.fromAggregate(session);
  }
}
