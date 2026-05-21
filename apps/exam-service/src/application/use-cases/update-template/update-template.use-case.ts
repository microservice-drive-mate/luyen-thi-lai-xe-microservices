import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { ExamTemplateNotFoundException } from '../../../domain/exceptions/exam.exceptions';
import { ExamTemplateRepository } from '../../../domain/repositories/exam-template.repository';
import { ExamTemplateResult } from '../shared/exam-template.result';
import { UpdateTemplateCommand } from './update-template.command';

@Injectable()
export class UpdateTemplateUseCase
  implements IUseCase<UpdateTemplateCommand, ExamTemplateResult>
{
  constructor(private readonly templateRepository: ExamTemplateRepository) {}

  async execute(command: UpdateTemplateCommand): Promise<ExamTemplateResult> {
    const template = await this.templateRepository.findById(command.id);
    if (!template) throw new ExamTemplateNotFoundException(command.id);
    template.update(command);
    await this.templateRepository.save(template);
    return ExamTemplateResult.fromAggregate(template);
  }
}
