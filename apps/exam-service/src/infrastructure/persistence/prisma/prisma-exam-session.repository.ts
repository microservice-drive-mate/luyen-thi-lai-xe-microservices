import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/exam-client';
import { ExamSession } from '../../../domain/aggregates/exam-session/exam-session.aggregate';
import {
  ExamSessionRepository,
  ListExamSessionsFilter,
  ListExamSessionsPage,
  MissedQuestionReviewFilter,
  MissedQuestionItem,
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
      ...(filter.studentId && { studentId: filter.studentId }),
      ...(filter.status && { status: filter.status }),
      ...(filter.isPassed !== undefined && { isPassed: filter.isPassed }),
      ...((filter.from || filter.to) && {
        startedAt: {
          ...(filter.from && { gte: filter.from }),
          ...(filter.to && { lte: filter.to }),
        },
      }),
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

  async findMissedQuestions(
    filter: MissedQuestionReviewFilter,
  ): Promise<MissedQuestionItem[]> {
    const since = filter.periodDays
      ? new Date(Date.now() - filter.periodDays * 24 * 60 * 60 * 1000)
      : undefined;
    const rows = await this.prisma.examSessionQuestion.findMany({
      where: {
        isCorrect: false,
        session: {
          studentId: filter.studentId,
          status: { in: ['COMPLETED', 'TIMED_OUT'] },
          ...(since && { finishedAt: { gte: since } }),
        },
      },
      orderBy: [{ answeredAt: 'desc' }],
      take: 500,
    });

    const grouped = new Map<
      string,
      { row: (typeof rows)[number]; count: number }
    >();
    for (const row of rows) {
      const existing = grouped.get(row.questionId);
      if (existing) {
        existing.count += 1;
      } else {
        grouped.set(row.questionId, { row, count: 1 });
      }
    }

    return [...grouped.values()]
      .sort((a, b) =>
        filter.mode === 'recent'
          ? (b.row.answeredAt?.getTime() ?? 0) -
            (a.row.answeredAt?.getTime() ?? 0)
          : b.count - a.count ||
            (b.row.answeredAt?.getTime() ?? 0) -
              (a.row.answeredAt?.getTime() ?? 0),
      )
      .slice(0, filter.limit)
      .map(({ row, count }) => ({
        questionId: row.questionId,
        content: row.questionContent,
        imageUrl: row.imageUrl,
        mediaFileId: row.mediaFileId,
        options: row.optionsSnapshot as Array<{
          id: string;
          content: string;
          displayOrder: number;
        }>,
        lastAnsweredAt: row.answeredAt,
        missedCount: count,
      }));
  }

  async save(session: ExamSession): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.examSession.upsert({
        where: { id: session.id },
        create: {
          id: session.id,
          studentId: session.studentId,
          templateId: session.templateId,
          templateNameSnapshot: session.templateNameSnapshot,
          templateVersionSnapshot: session.templateVersionSnapshot,
          licenseCategorySnapshot: session.licenseCategory,
          totalQuestionsSnapshot: session.totalQuestionsSnapshot,
          passingScoreSnapshot: session.passingScore,
          durationMinutesSnapshot: session.durationMinutes,
          criticalQuestionsSnapshot: session.criticalQuestionsSnapshot,
          topicDistributionSnapshot:
            session.topicDistributionSnapshot as Prisma.InputJsonValue,
          status: session.status,
          score: session.score,
          isPassed: session.isPassed,
          failedByCritical: session.failedByCritical,
          criticalMistakes: session.criticalMistakes,
          maxCriticalMistakes: session.maxCriticalMistakes,
          startedAt: session.startedAt,
          finishedAt: session.finishedAt,
          expiresAt: session.expiresAt,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
        update: {
          status: session.status,
          templateNameSnapshot: session.templateNameSnapshot,
          templateVersionSnapshot: session.templateVersionSnapshot,
          licenseCategorySnapshot: session.licenseCategory,
          totalQuestionsSnapshot: session.totalQuestionsSnapshot,
          passingScoreSnapshot: session.passingScore,
          durationMinutesSnapshot: session.durationMinutes,
          criticalQuestionsSnapshot: session.criticalQuestionsSnapshot,
          topicDistributionSnapshot:
            session.topicDistributionSnapshot as Prisma.InputJsonValue,
          score: session.score,
          isPassed: session.isPassed,
          failedByCritical: session.failedByCritical,
          criticalMistakes: session.criticalMistakes,
          finishedAt: session.finishedAt,
          expiresAt: session.expiresAt,
          updatedAt: session.updatedAt,
        },
      });

      for (const question of session.questions) {
        const questionData = {
          sessionId: session.id,
          questionId: question.questionId,
          questionContent: question.questionContent,
          imageUrl: question.imageUrl,
          mediaFileId: question.mediaFileId,
          optionsSnapshot:
            question.optionsSnapshot as unknown as Prisma.InputJsonValue,
          correctOptionId: question.correctOptionId,
          isCritical: question.isCritical,
          displayOrder: question.displayOrder,
          selectedOptionId: question.selectedOptionId,
          isCorrect: question.isCorrect,
          isBookmarked: question.isBookmarked,
          answeredAt: question.answeredAt,
        };

        await tx.examSessionQuestion.upsert({
          where: { id: question.id },
          create: { id: question.id, ...questionData },
          update: questionData,
        });
      }
    });
  }
}
