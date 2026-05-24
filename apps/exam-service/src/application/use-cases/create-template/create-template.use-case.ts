import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
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
    await this.templateRepository.save(
      template,
      createAuditEvent({
        serviceName: 'exam-service',
        actorId: command.createdById,
        action: 'EXAM_TEMPLATE_CREATED',
        resourceType: 'EXAM_TEMPLATE',
        resourceId: template.id,
        requestContext: command.auditContext,
        metadata: {
          name: template.name,
          licenseCategory: template.licenseCategory,
        },
      }),
    );
    return ExamTemplateResult.fromAggregate(template);
  }
}
