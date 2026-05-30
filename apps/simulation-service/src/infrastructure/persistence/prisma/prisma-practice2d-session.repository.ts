import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/simulation-client';
import { Practice2dSession } from '../../../domain/aggregates/practice2d/practice2d-session.aggregate';
import {
  FeedbackSeverity,
  Practice2dSessionStatus,
} from '../../../domain/aggregates/practice2d/practice2d-session.types';
import { Practice2dSessionRepository } from '../../../domain/repositories/practice2d-session.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaPractice2dSessionRepository extends Practice2dSessionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<Practice2dSession | null> {
    const raw = await this.prisma.practice2dSession.findUnique({
      where: { id },
      include: { feedbackEvents: { orderBy: { occurredAt: 'asc' } } },
    });
    if (!raw) return null;
    return Practice2dSession.reconstitute({
      id: raw.id,
      studentId: raw.studentId,
      licenseCategory: raw.licenseCategory,
      status: raw.status as Practice2dSessionStatus,
      clientCapabilities: (raw.clientCapabilities ?? {}) as Record<
        string,
        boolean
      >,
      persistTelemetry: raw.persistTelemetry,
      telemetrySnapshot: raw.telemetrySnapshot,
      totalEvents: raw.totalEvents,
      errorCount: raw.errorCount,
      totalPenalty: raw.totalPenalty,
      score: raw.score,
      summary: raw.summary,
      startedAt: raw.startedAt,
      endedAt: raw.endedAt,
      feedbackEvents: raw.feedbackEvents.map((event) => ({
        id: event.id,
        telemetryType: event.telemetryType,
        errorCode: event.errorCode,
        severity: event.severity as FeedbackSeverity,
        penalty: event.penalty,
        message: event.message,
        hint: event.hint,
        telemetry: event.telemetry,
        occurredAt: event.occurredAt,
      })),
    });
  }

  async save(session: Practice2dSession): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.practice2dSession.upsert({
        where: { id: session.id },
        create: {
          id: session.id,
          studentId: session.studentId,
          licenseCategory: session.licenseCategory as never,
          status: session.status as never,
          clientCapabilities:
            session.clientCapabilities as Prisma.InputJsonValue,
          persistTelemetry: session.persistTelemetry,
          telemetrySnapshot:
            (session.telemetrySnapshot as Prisma.InputJsonValue) ?? undefined,
          totalEvents: session.totalEvents,
          errorCount: session.errorCount,
          totalPenalty: session.totalPenalty,
          score: session.score,
          summary: session.summary as Prisma.InputJsonValue,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
        },
        update: {
          status: session.status as never,
          telemetrySnapshot:
            (session.telemetrySnapshot as Prisma.InputJsonValue) ?? undefined,
          totalEvents: session.totalEvents,
          errorCount: session.errorCount,
          totalPenalty: session.totalPenalty,
          score: session.score,
          summary: session.summary as Prisma.InputJsonValue,
          endedAt: session.endedAt,
        },
      });

      for (const event of session.feedbackEvents) {
        await tx.practice2dFeedbackEvent.upsert({
          where: { id: event.id },
          create: {
            id: event.id,
            sessionId: session.id,
            telemetryType: event.telemetryType,
            errorCode: event.errorCode,
            severity: event.severity,
            penalty: event.penalty,
            message: event.message,
            hint: event.hint,
            telemetry: event.telemetry as Prisma.InputJsonValue,
            occurredAt: event.occurredAt,
          },
          update: {},
        });
      }
    });
  }
}
