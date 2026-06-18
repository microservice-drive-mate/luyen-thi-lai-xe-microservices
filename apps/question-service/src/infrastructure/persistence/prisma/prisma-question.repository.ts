import { Injectable } from '@nestjs/common';
import { normalizeQuestionContent } from '../../../application/use-cases/shared/question-signature';
import { Question } from '../../../domain/aggregates/question/question.aggregate';
import {
  ListQuestionsFilter,
  ListQuestionsPage,
  QuestionPoolFilter,
  QuestionRepository,
} from '../../../domain/repositories/question.repository';
import { QuestionMapper } from '../mappers/question.mapper';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaQuestionRepository extends QuestionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<Question | null> {
    const raw = await this.prisma.question.findUnique({
      where: { id },
      include: { options: { orderBy: { displayOrder: 'asc' } } },
    });
    return raw ? QuestionMapper.toDomain(raw) : null;
  }

  async findAll(filter: ListQuestionsFilter): Promise<ListQuestionsPage> {
    const where = {
      ...(filter.keyword && {
        content: { contains: filter.keyword, mode: 'insensitive' as const },
      }),
      ...(filter.licenseCategory && {
        licenseCategories: { has: filter.licenseCategory },
      }),
      ...(filter.type && { type: filter.type }),
      ...(filter.difficulty && { difficulty: filter.difficulty }),
      ...(filter.topicId && { topicId: filter.topicId }),
      ...(filter.isCritical !== undefined && {
        isCritical: filter.isCritical,
      }),
      ...(filter.isActive !== undefined && { isActive: filter.isActive }),
      ...(!filter.includeDeleted && { isDeleted: false }),
    };
    const skip = (filter.page - 1) * filter.size;

    const [rawItems, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        skip,
        take: filter.size,
        orderBy: { createdAt: 'desc' },
        include: { options: { orderBy: { displayOrder: 'asc' } } },
      }),
      this.prisma.question.count({ where }),
    ]);

    return {
      items: rawItems.map(QuestionMapper.toDomain),
      total,
    };
  }

  async getPool(filter: QuestionPoolFilter): Promise<Question[]> {
    const rawItems = await this.prisma.question.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        licenseCategories: { has: filter.licenseCategory },
        ...(filter.type && { type: filter.type }),
        ...(filter.difficulty && { difficulty: filter.difficulty }),
        ...(filter.topicId && { topicId: filter.topicId }),
        ...(filter.isCritical !== undefined && {
          isCritical: filter.isCritical,
        }),
        ...(filter.excludeQuestionIds?.length && {
          id: { notIn: filter.excludeQuestionIds },
        }),
      },
      take: Math.max(filter.size * 3, filter.size),
      orderBy: { createdAt: 'desc' },
      include: { options: { orderBy: { displayOrder: 'asc' } } },
    });

    return rawItems
      .sort(() => Math.random() - 0.5)
      .slice(0, filter.size)
      .map(QuestionMapper.toDomain);
  }

  async existsBySignature(
    normalizedContent: string,
    topicId: string,
    excludeQuestionId?: string,
  ): Promise<boolean> {
    const candidates = await this.prisma.question.findMany({
      where: {
        topicId,
        isDeleted: false,
        ...(excludeQuestionId && { id: { not: excludeQuestionId } }),
      },
      select: { content: true },
      take: 100,
    });
    return candidates.some(
      (candidate) =>
        normalizeQuestionContent(candidate.content) === normalizedContent,
    );
  }

  async save(question: Question): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.question.findUnique({
        where: { id: question.id },
        include: { options: { orderBy: { displayOrder: 'asc' } } },
      });
      if (existing && existing.version < question.version) {
        await tx.questionVersion.upsert({
          where: {
            questionId_version: {
              questionId: existing.id,
              version: existing.version,
            },
          },
          create: {
            questionId: existing.id,
            version: existing.version,
            content: existing.content,
            type: existing.type,
            licenseCategories: existing.licenseCategories,
            difficulty: existing.difficulty,
            explanation: existing.explanation,
            imageUrl: existing.imageUrl,
            mediaFileId: existing.mediaFileId,
            isCritical: existing.isCritical,
            isActive: existing.isActive,
            topicId: existing.topicId,
            optionsSnapshot: existing.options.map((option) => ({
              id: option.id,
              content: option.content,
              isCorrect: option.isCorrect,
              displayOrder: option.displayOrder,
            })),
          },
          update: {},
        });
      }

      await tx.question.upsert({
        where: { id: question.id },
        create: {
          id: question.id,
          content: question.content,
          type: question.type,
          licenseCategories: question.licenseCategories,
          difficulty: question.difficulty,
          explanation: question.explanation,
          imageUrl: question.imageUrl,
          mediaFileId: question.mediaFileId,
          isCritical: question.isCritical,
          isActive: question.isActive,
          isDeleted: question.isDeleted,
          topicId: question.topicId,
          createdById: question.createdById,
          version: question.version,
          deletedById: question.deletedById,
          deletedAt: question.deletedAt,
          createdAt: question.createdAt,
          updatedAt: question.updatedAt,
        },
        update: {
          content: question.content,
          type: question.type,
          licenseCategories: question.licenseCategories,
          difficulty: question.difficulty,
          explanation: question.explanation,
          imageUrl: question.imageUrl,
          mediaFileId: question.mediaFileId,
          isCritical: question.isCritical,
          isActive: question.isActive,
          isDeleted: question.isDeleted,
          topicId: question.topicId,
          version: question.version,
          deletedById: question.deletedById,
          deletedAt: question.deletedAt,
          updatedAt: question.updatedAt,
        },
      });

      await tx.questionOption.deleteMany({
        where: { questionId: question.id },
      });
      if (question.options.length > 0) {
        await tx.questionOption.createMany({
          data: question.options.map((option) => ({
            id: option.id,
            questionId: question.id,
            content: option.content,
            isCorrect: option.isCorrect,
            displayOrder: option.displayOrder,
          })),
        });
      }
    });
  }
}
