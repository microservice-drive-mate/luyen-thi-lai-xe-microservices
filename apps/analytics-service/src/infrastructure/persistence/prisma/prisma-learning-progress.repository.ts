import { Injectable } from '@nestjs/common';
import {
  LearningProfileSnapshot,
  StudentLearningProgress,
} from '../../../domain/aggregates/learning-progress/learning-progress.aggregate';
import {
  ExamCompletedPayload,
  LearningProgressRepository,
  ProgressDashboard,
} from '../../../domain/repositories/learning-progress.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaLearningProgressRepository extends LearningProgressRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async ensureStudent(studentId: string): Promise<void> {
    await this.prisma.studentLearningProfile.upsert({
      where: { studentId },
      create: { id: studentId, studentId },
      update: {},
    });
  }

  async recordExamCompleted(payload: ExamCompletedPayload): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.studentLearningProfile.findUnique({
        where: { studentId: payload.studentId },
      });
      const profile = existing
        ? StudentLearningProgress.reconstitute(
            this.mapLearningProfile(existing),
          )
        : StudentLearningProgress.create(payload.studentId);
      const projection = profile.recordExamCompleted(payload);

      await tx.studentLearningProfile.upsert({
        where: { studentId: payload.studentId },
        create: {
          id: payload.studentId,
          studentId: payload.studentId,
          totalExamAttempts: 1,
          passedExams: payload.isPassed ? 1 : 0,
          avgExamScore: projection.avgExamScore,
          lastActivityAt: projection.occurredAt,
        },
        update: {
          totalExamAttempts: { increment: 1 },
          passedExams: { increment: payload.isPassed ? 1 : 0 },
          avgExamScore: projection.avgExamScore,
          lastActivityAt: projection.occurredAt,
        },
      });

      await tx.dailyActivity.upsert({
        where: {
          studentId_date: {
            studentId: projection.studentId,
            date: projection.date,
          },
        },
        create: {
          studentId: projection.studentId,
          date: projection.date,
          examsAttempted: 1,
          questionsAnswered: projection.questionsAnswered,
          correctAnswers: projection.correctAnswers,
        },
        update: {
          examsAttempted: { increment: 1 },
          questionsAnswered: { increment: projection.questionsAnswered },
          correctAnswers: { increment: projection.correctAnswers },
        },
      });

      for (const question of projection.questions) {
        await tx.questionAccuracyTracker.upsert({
          where: {
            studentId_questionId: {
              studentId: payload.studentId,
              questionId: question.questionId,
            },
          },
          create: {
            studentId: payload.studentId,
            questionId: question.questionId,
            topicId: question.topicId,
            topicName: question.topicName,
            totalAttempts: 1,
            correctAttempts: question.isCorrect ? 1 : 0,
            lastAttemptAt: projection.occurredAt,
          },
          update: {
            totalAttempts: { increment: 1 },
            correctAttempts: { increment: question.isCorrect ? 1 : 0 },
            lastAttemptAt: projection.occurredAt,
          },
        });
      }
    });
  }

  async recordEnrollmentCreated(studentId: string): Promise<void> {
    await this.ensureStudent(studentId);
    await this.prisma.studentLearningProfile.update({
      where: { studentId },
      data: { coursesEnrolled: { increment: 1 }, lastActivityAt: new Date() },
    });
  }

  async recordEnrollmentCompleted(studentId: string): Promise<void> {
    await this.ensureStudent(studentId);
    await this.prisma.studentLearningProfile.update({
      where: { studentId },
      data: { coursesCompleted: { increment: 1 }, lastActivityAt: new Date() },
    });
  }

  async recordLessonCompleted(
    studentId: string,
    minutes: number,
  ): Promise<void> {
    const projection =
      StudentLearningProgress.create(studentId).recordLessonCompleted(minutes);
    await this.prisma.$transaction([
      this.prisma.studentLearningProfile.upsert({
        where: { studentId },
        create: {
          id: studentId,
          studentId,
          totalStudyMinutes: projection.minutes,
          lastActivityAt: projection.occurredAt,
        },
        update: {
          totalStudyMinutes: { increment: projection.minutes },
          lastActivityAt: projection.occurredAt,
        },
      }),
      this.prisma.dailyActivity.upsert({
        where: { studentId_date: { studentId, date: projection.date } },
        create: {
          studentId,
          date: projection.date,
          studyMinutes: projection.minutes,
        },
        update: { studyMinutes: { increment: projection.minutes } },
      }),
    ]);
  }

  async resetProgress(studentId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.studentLearningProfile.upsert({
        where: { studentId },
        create: { id: studentId, studentId, resetAt: new Date() },
        update: {
          totalStudyMinutes: 0,
          coursesCompleted: 0,
          lastActivityAt: new Date(),
          resetAt: new Date(),
        },
      }),
      this.prisma.dailyActivity.deleteMany({ where: { studentId } }),
      this.prisma.questionAccuracyTracker.deleteMany({ where: { studentId } }),
    ]);
  }

  async getDashboard(studentId: string): Promise<ProgressDashboard> {
    await this.ensureStudent(studentId);
    const [profile, trendRows, weakRows] = await this.prisma.$transaction([
      this.prisma.studentLearningProfile.findUniqueOrThrow({
        where: { studentId },
      }),
      this.prisma.dailyActivity.findMany({
        where: { studentId },
        orderBy: { date: 'desc' },
        take: 30,
      }),
      this.prisma.questionAccuracyTracker.findMany({
        where: { studentId, totalAttempts: { gt: 0 } },
        orderBy: [{ lastAttemptAt: 'desc' }],
        take: 100,
      }),
    ]);

    return StudentLearningProgress.reconstitute(
      this.mapLearningProfile(profile),
    ).buildDashboard(trendRows, weakRows);
  }

  private mapLearningProfile(
    record: LearningProfileSnapshot,
  ): LearningProfileSnapshot {
    return {
      id: record.id,
      studentId: record.studentId,
      totalStudyMinutes: record.totalStudyMinutes,
      totalExamAttempts: record.totalExamAttempts,
      passedExams: record.passedExams,
      avgExamScore: record.avgExamScore,
      coursesEnrolled: record.coursesEnrolled,
      coursesCompleted: record.coursesCompleted,
      lastActivityAt: record.lastActivityAt,
      resetAt: record.resetAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
