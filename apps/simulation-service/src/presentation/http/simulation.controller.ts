import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import {
  GetManeuverUseCase,
  ListManeuverErrorsUseCase,
  ListManeuversUseCase,
  SaveSimulationAnswerUseCase,
  StartSimulationSessionUseCase,
  SubmitSimulationSessionUseCase,
} from '../../application/use-cases/simulation.use-cases';
import {
  EndPractice2dSessionUseCase,
  GetPractice2dSessionUseCase,
  IngestPractice2dTelemetryUseCase,
  StartPractice2dSessionUseCase,
} from '../../application/use-cases/practice2d/practice2d.use-cases';
import {
  EndPractice2dSessionCommand,
  IngestPractice2dTelemetryCommand,
  StartPractice2dSessionCommand,
} from '../../application/use-cases/practice2d/practice2d.commands';
import {
  EndPractice2dSessionRequestDto,
  LicenseCategoryQueryDto,
  ManeuverErrorResponseDto,
  ManeuverResponseDto,
  Practice2dFeedbackResponseDto,
  Practice2dSessionResponseDto,
  Practice2dTelemetryRequestDto,
  SaveSimulationAnswerRequestDto,
  SimulationSessionResponseDto,
  StartPractice2dSessionRequestDto,
  StartSimulationSessionRequestDto,
} from '../dtos/simulation.dtos';

interface JwtPayload {
  sub?: string;
}

@ApiTags('Simulation')
@ApiBearerAuth()
@Controller('simulation')
export class SimulationController {
  constructor(
    private readonly listManeuversUseCase: ListManeuversUseCase,
    private readonly getManeuverUseCase: GetManeuverUseCase,
    private readonly listManeuverErrorsUseCase: ListManeuverErrorsUseCase,
    private readonly startSimulationSessionUseCase: StartSimulationSessionUseCase,
    private readonly saveSimulationAnswerUseCase: SaveSimulationAnswerUseCase,
    private readonly submitSimulationSessionUseCase: SubmitSimulationSessionUseCase,
    private readonly startPractice2dSessionUseCase: StartPractice2dSessionUseCase,
    private readonly ingestPractice2dTelemetryUseCase: IngestPractice2dTelemetryUseCase,
    private readonly endPractice2dSessionUseCase: EndPractice2dSessionUseCase,
    private readonly getPractice2dSessionUseCase: GetPractice2dSessionUseCase,
  ) {}

  @Get('maneuvers')
  @Roles({
    roles: [
      'realm:STUDENT',
      'realm:INSTRUCTOR',
      'realm:ADMIN',
      'realm:CENTER_MANAGER',
    ],
  })
  @ApiOperation({ summary: 'List maneuver checkpoints by license category' })
  async listManeuvers(
    @Query() query: LicenseCategoryQueryDto,
  ): Promise<ManeuverResponseDto[]> {
    const result = await this.listManeuversUseCase.execute(
      query.licenseCategory,
    );
    return result.map(ManeuverResponseDto.fromRecord);
  }

  @Get('maneuvers/:id')
  @Roles({
    roles: [
      'realm:STUDENT',
      'realm:INSTRUCTOR',
      'realm:ADMIN',
      'realm:CENTER_MANAGER',
    ],
  })
  @ApiOperation({ summary: 'Get maneuver checkpoint details' })
  async getManeuver(@Param('id') id: string): Promise<ManeuverResponseDto> {
    const result = await this.getManeuverUseCase.execute(id);
    if (!result) throw new NotFoundException('Maneuver not found');
    return ManeuverResponseDto.fromRecord(result);
  }

  @Get('maneuver-errors')
  @Roles({
    roles: [
      'realm:STUDENT',
      'realm:INSTRUCTOR',
      'realm:ADMIN',
      'realm:CENTER_MANAGER',
    ],
  })
  @ApiOperation({ summary: 'List general maneuver errors by license category' })
  async listErrors(
    @Query() query: LicenseCategoryQueryDto,
  ): Promise<ManeuverErrorResponseDto[]> {
    const result = await this.listManeuverErrorsUseCase.execute(
      query.licenseCategory,
    );
    return result.map(ManeuverErrorResponseDto.fromRecord);
  }

  @Post('sessions')
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({ summary: 'Start a driving practice simulation session' })
  async startSession(
    @AuthenticatedUser() user: JwtPayload,
    @Body() dto: StartSimulationSessionRequestDto,
  ): Promise<SimulationSessionResponseDto> {
    const result = await this.startSimulationSessionUseCase.execute(
      user.sub ?? '',
      dto.licenseCategory,
    );
    return SimulationSessionResponseDto.fromRecord(result);
  }

  @Patch('sessions/:id/answers')
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({
    summary: 'Save simulation answer while session is in progress',
  })
  async saveAnswer(
    @AuthenticatedUser() user: JwtPayload,
    @Param('id') sessionId: string,
    @Body() dto: SaveSimulationAnswerRequestDto,
  ): Promise<SimulationSessionResponseDto> {
    const result = await this.saveSimulationAnswerUseCase.execute({
      sessionId,
      studentId: user.sub ?? '',
      scenarioId: dto.scenarioId,
      selectedOptionId: dto.selectedOptionId,
      isCorrect: dto.isCorrect,
    });
    return SimulationSessionResponseDto.fromRecord(result);
  }

  @Post('sessions/:id/submit')
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({ summary: 'Submit simulation session' })
  async submit(
    @AuthenticatedUser() user: JwtPayload,
    @Param('id') sessionId: string,
  ): Promise<SimulationSessionResponseDto> {
    const result = await this.submitSimulationSessionUseCase.execute(
      sessionId,
      user.sub ?? '',
    );
    return SimulationSessionResponseDto.fromRecord(result);
  }

  @Post('practice2d/sessions')
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({ summary: 'Start a 2D driving practice session' })
  async startPractice2d(
    @AuthenticatedUser() user: JwtPayload,
    @Body() dto: StartPractice2dSessionRequestDto,
  ): Promise<Practice2dSessionResponseDto> {
    const result = await this.startPractice2dSessionUseCase.execute(
      new StartPractice2dSessionCommand(
        user.sub ?? '',
        dto.licenseCategory,
        dto.clientCapabilities,
        dto.persistTelemetry ?? false,
      ),
    );
    return Practice2dSessionResponseDto.fromResult(result);
  }

  @Post('practice2d/sessions/:id/telemetry')
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({ summary: 'Ingest 2D practice telemetry and return feedback' })
  async ingestPracticeTelemetry(
    @AuthenticatedUser() user: JwtPayload,
    @Param('id') sessionId: string,
    @Body() dto: Practice2dTelemetryRequestDto,
  ): Promise<Practice2dFeedbackResponseDto> {
    const result = await this.ingestPractice2dTelemetryUseCase.execute(
      new IngestPractice2dTelemetryCommand(
        sessionId,
        user.sub ?? '',
        dto.type,
        dto.speedKmh,
        dto.laneOffset,
        dto.collision,
        dto.signal,
        dto.payload,
      ),
    );
    return Practice2dFeedbackResponseDto.fromResult(result);
  }

  @Post('practice2d/sessions/:id/end')
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({ summary: 'End a 2D practice session and return summary' })
  async endPractice2d(
    @AuthenticatedUser() user: JwtPayload,
    @Param('id') sessionId: string,
    @Body() dto: EndPractice2dSessionRequestDto,
  ): Promise<Practice2dSessionResponseDto> {
    const result = await this.endPractice2dSessionUseCase.execute(
      new EndPractice2dSessionCommand(
        sessionId,
        user.sub ?? '',
        dto.abandoned ?? false,
      ),
    );
    return Practice2dSessionResponseDto.fromResult(result);
  }

  @Get('practice2d/sessions/:id')
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({ summary: 'Get a 2D practice session summary' })
  async getPractice2d(
    @AuthenticatedUser() user: JwtPayload,
    @Param('id') sessionId: string,
  ): Promise<Practice2dSessionResponseDto> {
    const result = await this.getPractice2dSessionUseCase.execute({
      sessionId,
      studentId: user.sub ?? '',
    });
    return Practice2dSessionResponseDto.fromResult(result);
  }
}
