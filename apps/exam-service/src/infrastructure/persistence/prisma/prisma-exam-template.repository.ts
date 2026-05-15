import { Injectable } from '@nestjs/common';
import { ExamTemplate } from '../../../domain/aggregates/exam-template/exam-template.aggregate';
import {
  ExamTemplateRepository,
  ListExamTemplatesFilter,
  ListExamTemplatesPage,
} from '../../../domain/repositories/exam-template.repository';
import { ExamTemplateMapper } from '../mappers/exam-template.mapper';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaExamTemplateRepository extends ExamTemplateRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<ExamTemplate | null> {
    const raw = await this.prisma.examTemplate.findUnique({ where: { id } });
    return raw ? ExamTemplateMapper.toDomain(raw) : null;
  }

  async findAll(
    filter: ListExamTemplatesFilter,
  ): Promise<ListExamTemplatesPage> {
    const where = {
      ...(filter.licenseCategory && {
        licenseCategory: filter.licenseCategory,
      }),
      ...(filter.isActive !== undefined && { isActive: filter.isActive }),
      ...(!filter.includeDeleted && { isDeleted: false }),
    };
    const skip = (filter.page - 1) * filter.size;
    const [rawItems, total] = await this.prisma.$transaction([
      this.prisma.examTemplate.findMany({
        where,
        skip,
        take: filter.size,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.examTemplate.count({ where }),
    ]);
    return { items: rawItems.map(ExamTemplateMapper.toDomain), total };
  }

  async hasSessions(templateId: string): Promise<boolean> {
    const count = await this.prisma.examSession.count({
      where: { templateId },
      take: 1,
    });
    return count > 0;
  }

  async save(template: ExamTemplate): Promise<void> {
    await this.prisma.examTemplate.upsert({
      where: { id: template.id },
      create: {
        id: template.id,
        name: template.name,
        licenseCategory: template.licenseCategory,
        totalQuestions: template.totalQuestions,
        passingScore: template.passingScore,
        durationMinutes: template.durationMinutes,
        isActive: template.isActive,
        isDeleted: template.isDeleted,
        version: template.version,
        createdById: template.createdById,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      },
      update: {
        name: template.name,
        totalQuestions: template.totalQuestions,
        passingScore: template.passingScore,
        durationMinutes: template.durationMinutes,
        isActive: template.isActive,
        isDeleted: template.isDeleted,
        version: template.version,
        updatedAt: template.updatedAt,
      },
    });
  }
}
