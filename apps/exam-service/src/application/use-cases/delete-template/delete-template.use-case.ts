import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import {
  ExamTemplateInUseException,
  ExamTemplateNotFoundException,
} from '../../../domain/exceptions/exam.exceptions';
import { ExamTemplateRepository } from '../../../domain/repositories/exam-template.repository';
import { ExamTemplateResult } from '../shared/exam-template.result';
import { DeleteTemplateCommand } from './delete-template.command';

@Injectable()
export class DeleteTemplateUseCase
  implements IUseCase<DeleteTemplateCommand, ExamTemplateResult>
{
  constructor(private readonly templateRepository: ExamTemplateRepository) {}

  async execute(command: DeleteTemplateCommand): Promise<ExamTemplateResult> {
    const template = await this.templateRepository.findById(command.id);
    if (!template) throw new ExamTemplateNotFoundException(command.id);
    if (await this.templateRepository.hasSessions(command.id)) {
      throw new ExamTemplateInUseException(command.id);
    }
    template.softDelete(command.expectedVersion);
    await this.templateRepository.save(template);
    return ExamTemplateResult.fromAggregate(template);
  }
}
