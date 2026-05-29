import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LicenseCategory,
  SimulationSessionStatus,
} from '@prisma/simulation-client';
import {
  ManeuverErrorRecord,
  ManeuverRecord,
  SimulationRepository,
  SimulationSessionRecord,
} from '../../../domain/repositories/simulation.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaSimulationRepository extends SimulationRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listManeuvers(
    licenseCategory: LicenseCategory,
  ): Promise<ManeuverRecord[]> {
    return this.prisma.maneuver.findMany({
      where: { licenseCategory, isActive: true },
      include: { checkpoints: { orderBy: { displayOrder: 'asc' } } },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async getManeuver(id: string): Promise<ManeuverRecord | null> {
    return this.prisma.maneuver.findFirst({
      where: { id, isActive: true },
      include: { checkpoints: { orderBy: { displayOrder: 'asc' } } },
    });
  }

  async listErrors(
    licenseCategory: LicenseCategory,
  ): Promise<ManeuverErrorRecord[]> {
    return this.prisma.maneuverError.findMany({
      where: { licenseCategory, isGeneral: true, isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  async createSession(
    studentId: string,
    licenseCategory: LicenseCategory,
  ): Promise<SimulationSessionRecord> {
    return this.prisma.simulationSession.create({
      data: { studentId, licenseCategory },
    });
  }

  async saveAnswer(input: {
    sessionId: string;
    studentId: string;
    scenarioId: string;
    selectedOptionId?: string | null;
    isCorrect?: boolean | null;
  }): Promise<SimulationSessionRecord> {
    const session = await this.prisma.simulationSession.findFirst({
      where: { id: input.sessionId, studentId: input.studentId },
    });
    if (!session) {
      throw new NotFoundException('Session not found or not active. (MSG136)');
    }
    if (session.status !== SimulationSessionStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Session not found or not active. (MSG136)',
      );
    }

    await this.prisma.simulationAnswer.upsert({
      where: {
        sessionId_scenarioId: {
          sessionId: input.sessionId,
          scenarioId: input.scenarioId,
        },
      },
      create: {
        sessionId: input.sessionId,
        scenarioId: input.scenarioId,
        selectedOptionId: input.selectedOptionId,
        isCorrect: input.isCorrect,
      },
      update: {
        selectedOptionId: input.selectedOptionId,
        isCorrect: input.isCorrect,
        answeredAt: new Date(),
      },
    });

    return session;
  }

  async submitSession(
    sessionId: string,
    studentId: string,
  ): Promise<SimulationSessionRecord> {
    const session = await this.prisma.simulationSession.findFirst({
      where: { id: sessionId, studentId },
      include: { answers: true },
    });
    if (!session) {
      throw new NotFoundException('Session not found or not active. (MSG136)');
    }
    if (session.status !== SimulationSessionStatus.IN_PROGRESS) return session;

    const totalScenarios = session.answers.length;
    const correctCount = session.answers.filter(
      (answer) => answer.isCorrect,
    ).length;
    const score =
      totalScenarios === 0
        ? 0
        : Math.round((correctCount / totalScenarios) * 100);

    return this.prisma.simulationSession.update({
      where: { id: sessionId },
      data: {
        status: SimulationSessionStatus.COMPLETED,
        totalScenarios,
        correctCount,
        score,
        isPassed: score >= 80,
        completedAt: new Date(),
      },
    });
  }
}
