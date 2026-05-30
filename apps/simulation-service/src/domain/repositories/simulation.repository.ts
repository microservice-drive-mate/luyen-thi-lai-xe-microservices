import {
  LicenseCategory,
  SimulationSessionStatus,
} from '@prisma/simulation-client';

export interface ManeuverRecord {
  id: string;
  title: string;
  description: string;
  licenseCategory: LicenseCategory;
  displayOrder: number;
  checkpoints: Array<{
    id: string;
    title: string;
    instruction: string;
    penalty: string | null;
    x?: number | null;
    y?: number | null;
    visualColor?: string | null;
    displayOrder: number;
  }>;
}

export interface ManeuverErrorRecord {
  id: string;
  licenseCategory: LicenseCategory;
  code: string;
  description: string;
  severity: string;
  pointsDeducted: number;
  isFatal: boolean;
  isGeneral: boolean;
  isActive: boolean;
  visualColor: string | null;
  icon: string | null;
}

export interface SimulationSessionRecord {
  id: string;
  studentId: string;
  licenseCategory: LicenseCategory;
  status: SimulationSessionStatus;
  totalScenarios: number;
  correctCount: number;
  score: number | null;
  isPassed: boolean | null;
  startedAt: Date;
  completedAt: Date | null;
}

export abstract class SimulationRepository {
  abstract listManeuvers(
    licenseCategory: LicenseCategory,
  ): Promise<ManeuverRecord[]>;
  abstract getManeuver(id: string): Promise<ManeuverRecord | null>;
  abstract listErrors(
    licenseCategory: LicenseCategory,
  ): Promise<ManeuverErrorRecord[]>;
  abstract createSession(
    studentId: string,
    licenseCategory: LicenseCategory,
  ): Promise<SimulationSessionRecord>;
  abstract saveAnswer(input: {
    sessionId: string;
    studentId: string;
    scenarioId: string;
    selectedOptionId?: string | null;
    isCorrect?: boolean | null;
  }): Promise<SimulationSessionRecord>;
  abstract submitSession(
    sessionId: string,
    studentId: string,
  ): Promise<SimulationSessionRecord>;
}
