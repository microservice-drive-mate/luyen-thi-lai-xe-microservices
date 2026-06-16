import { Injectable } from '@nestjs/common';
import { LicenseCategory } from '@prisma/simulation-client';
import { ManeuverErrorCacheService } from '../../infrastructure/cache/maneuver-error-cache.service';
import { SimulationRepository } from '../../domain/repositories/simulation.repository';

@Injectable()
export class ListManeuversUseCase {
  constructor(private readonly repository: SimulationRepository) {}

  execute(licenseCategory: LicenseCategory) {
    return this.repository.listManeuvers(licenseCategory);
  }
}

@Injectable()
export class GetManeuverUseCase {
  constructor(private readonly repository: SimulationRepository) {}

  execute(id: string) {
    return this.repository.getManeuver(id);
  }
}

@Injectable()
export class ListManeuverErrorsUseCase {
  constructor(
    private readonly repository: SimulationRepository,
    private readonly cache: ManeuverErrorCacheService,
  ) {}

  async execute(licenseCategory: LicenseCategory) {
    const cached = await this.cache.get(licenseCategory);
    if (cached) return cached;
    const items = await this.repository.listErrors(licenseCategory);
    await this.cache.set(licenseCategory, items);
    return items;
  }
}

@Injectable()
export class StartSimulationSessionUseCase {
  constructor(private readonly repository: SimulationRepository) {}

  execute(studentId: string, licenseCategory: LicenseCategory) {
    return this.repository.createSession(studentId, licenseCategory);
  }
}

@Injectable()
export class SaveSimulationAnswerUseCase {
  constructor(private readonly repository: SimulationRepository) {}

  execute(input: {
    sessionId: string;
    studentId: string;
    scenarioId: string;
    selectedOptionId?: string | null;
    isCorrect?: boolean | null;
  }) {
    return this.repository.saveAnswer(input);
  }
}

@Injectable()
export class SubmitSimulationSessionUseCase {
  constructor(private readonly repository: SimulationRepository) {}

  execute(sessionId: string, studentId: string) {
    return this.repository.submitSession(sessionId, studentId);
  }
}

@Injectable()
export class ListSimulationSessionsUseCase {
  constructor(private readonly repository: SimulationRepository) {}

  execute(studentId: string) {
    return this.repository.listSessions(studentId);
  }
}

@Injectable()
export class GetSimulationSessionResultUseCase {
  constructor(private readonly repository: SimulationRepository) {}

  execute(sessionId: string, studentId: string) {
    return this.repository.getSessionResult(sessionId, studentId);
  }
}
