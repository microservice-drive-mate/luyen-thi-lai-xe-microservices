import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { ExamTemplateNotFoundException } from '../../../domain/exceptions/exam.exceptions';
import { ExamTemplateRepository } from '../../../domain/repositories/exam-template.repository';
import { ExamTemplateResult } from '../shared/exam-template.result';
import { GetTemplateQuery } from './get-template.query';

@Injectable()
export class GetTemplateUseCase
  implements IUseCase<GetTemplateQuery, ExamTemplateResult>
{
  constructor(private readonly templateRepository: ExamTemplateRepository) {}

  async execute(query: GetTemplateQuery): Promise<ExamTemplateResult> {
    const template = await this.templateRepository.findById(query.id);
    if (!template) throw new ExamTemplateNotFoundException();
    return ExamTemplateResult.fromAggregate(template);
  }
}
