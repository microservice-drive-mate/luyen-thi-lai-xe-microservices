import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { ExamTemplate } from '../../../domain/aggregates/exam-template/exam-template.aggregate';
import { ExamTemplateRepository } from '../../../domain/repositories/exam-template.repository';
import { ExamTemplateResult } from '../shared/exam-template.result';
import { CreateTemplateCommand } from './create-template.command';

@Injectable()
export class CreateTemplateUseCase
  implements IUseCase<CreateTemplateCommand, ExamTemplateResult>
{
  constructor(private readonly templateRepository: ExamTemplateRepository) {}

  async execute(command: CreateTemplateCommand): Promise<ExamTemplateResult> {
    const template = ExamTemplate.create(command);
    await this.templateRepository.save(template);
    return ExamTemplateResult.fromAggregate(template);
  }
}
