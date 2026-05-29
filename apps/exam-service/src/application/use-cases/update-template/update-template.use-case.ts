import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
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
    if (!template) throw new ExamTemplateNotFoundException();
    template.update(command);
    await this.templateRepository.save(
      template,
      createAuditEvent({
        serviceName: 'exam-service',
        actorId: command.actorId ?? template.createdById,
        action: 'EXAM_TEMPLATE_UPDATED',
        resourceType: 'EXAM_TEMPLATE',
        resourceId: template.id,
        requestContext: command.auditContext,
        metadata: { name: template.name, version: template.version },
      }),
    );
    return ExamTemplateResult.fromAggregate(template);
  }
}
