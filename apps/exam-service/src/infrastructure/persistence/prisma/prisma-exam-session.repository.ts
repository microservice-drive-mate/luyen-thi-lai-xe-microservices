import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/exam-client';
import { ExamSession } from '../../../domain/aggregates/exam-session/exam-session.aggregate';
import {
  ExamSessionRepository,
  ListExamSessionsFilter,
  ListExamSessionsPage,
} from '../../../domain/repositories/exam-session.repository';
import { ExamSessionMapper } from '../mappers/exam-session.mapper';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaExamSessionRepository extends ExamSessionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<ExamSession | null> {
    const raw = await this.prisma.examSession.findUnique({
      where: { id },
      include: {
        template: true,
        questions: { orderBy: { displayOrder: 'asc' } },
      },
    });
    return raw ? ExamSessionMapper.toDomain(raw) : null;
  }

  async findAll(filter: ListExamSessionsFilter): Promise<ListExamSessionsPage> {
    const where = {
      studentId: filter.studentId,
      ...(filter.status && { status: filter.status }),
    };
    const skip = (filter.page - 1) * filter.size;
    const [rawItems, total] = await this.prisma.$transaction([
      this.prisma.examSession.findMany({
        where,
        skip,
        take: filter.size,
        orderBy: { startedAt: 'desc' },
        include: {
          template: true,
          questions: { orderBy: { displayOrder: 'asc' } },
        },
      }),
      this.prisma.examSession.count({ where }),
    ]);
    return { items: rawItems.map(ExamSessionMapper.toDomain), total };
  }

  async save(session: ExamSession): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.examSession.upsert({
        where: { id: session.id },
        create: {
          id: session.id,
          studentId: session.studentId,
          templateId: session.templateId,
          status: session.status,
          score: session.score,
          isPassed: session.isPassed,
          failedByCritical: session.failedByCritical,
          startedAt: session.startedAt,
          finishedAt: session.finishedAt,
          expiresAt: session.expiresAt,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
        update: {
          status: session.status,
          score: session.score,
          isPassed: session.isPassed,
          failedByCritical: session.failedByCritical,
          finishedAt: session.finishedAt,
          expiresAt: session.expiresAt,
          updatedAt: session.updatedAt,
        },
      });

      await tx.examSessionQuestion.deleteMany({
        where: { sessionId: session.id },
      });
      if (session.questions.length > 0) {
        await tx.examSessionQuestion.createMany({
          data: session.questions.map((question) => ({
            id: question.id,
            sessionId: session.id,
            questionId: question.questionId,
            questionContent: question.questionContent,
            optionsSnapshot:
              question.optionsSnapshot as unknown as Prisma.InputJsonValue,
            correctOptionId: question.correctOptionId,
            isCritical: question.isCritical,
            displayOrder: question.displayOrder,
            selectedOptionId: question.selectedOptionId,
            isCorrect: question.isCorrect,
            isBookmarked: question.isBookmarked,
            answeredAt: question.answeredAt,
          })),
        });
      }
    });
  }
}
