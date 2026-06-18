import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  LicenseCategory,
  SimulationSessionStatus,
} from '@prisma/simulation-client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  Practice2dFeedbackResult,
  Practice2dSessionResult,
} from '../../application/use-cases/practice2d/practice2d.result';
import {
  FeedbackSeverity,
  Practice2dSessionStatus,
} from '../../domain/aggregates/practice2d/practice2d-session.types';
import {
  ManeuverErrorRecord,
  ManeuverRecord,
  SimulationSessionRecord,
  SimulationSessionResultRecord,
} from '../../domain/repositories/simulation.repository';

export class LicenseCategoryQueryDto {
  @ApiProperty({ enum: LicenseCategory })
  @IsEnum(LicenseCategory)
  licenseCategory!: LicenseCategory;
}

export class StartSimulationSessionRequestDto {
  @ApiProperty({ enum: LicenseCategory })
  @IsEnum(LicenseCategory)
  licenseCategory!: LicenseCategory;
}

export class SaveSimulationAnswerRequestDto {
  @ApiProperty()
  @IsUUID()
  scenarioId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  selectedOptionId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean | null;
}

export class StartPractice2dSessionRequestDto {
  @ApiProperty({ enum: LicenseCategory })
  @IsEnum(LicenseCategory)
  licenseCategory!: LicenseCategory;

  @ApiProperty()
  @IsObject()
  clientCapabilities!: {
    canvas?: boolean;
    webgl?: boolean;
    keyboard?: boolean;
    touch?: boolean;
  };

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  persistTelemetry?: boolean;
}

export class Practice2dTelemetryRequestDto {
  @ApiProperty()
  @IsString()
  type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  speedKmh?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  laneOffset?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  collision?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signal?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  payload?: unknown;
}

export class EndPractice2dSessionRequestDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  abandoned?: boolean;
}

class ManeuverCheckpointResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() instruction!: string;
  @ApiProperty({ nullable: true }) penalty!: string | null;
  @ApiPropertyOptional({ nullable: true }) x?: number | null;
  @ApiPropertyOptional({ nullable: true }) y?: number | null;
  @ApiPropertyOptional({ nullable: true }) visualColor?: string | null;
  @ApiProperty() displayOrder!: number;
}

export class ManeuverResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: LicenseCategory }) licenseCategory!: LicenseCategory;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ type: [ManeuverCheckpointResponseDto] })
  checkpoints!: ManeuverCheckpointResponseDto[];

  static fromRecord(record: ManeuverRecord): ManeuverResponseDto {
    return Object.assign(new ManeuverResponseDto(), record);
  }
}

export class ManeuverErrorResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: LicenseCategory }) licenseCategory!: LicenseCategory;
  @ApiProperty() code!: string;
  @ApiProperty() description!: string;
  @ApiProperty() severity!: string;
  @ApiProperty() pointsDeducted!: number;
  @ApiProperty() isFatal!: boolean;
  @ApiProperty() isGeneral!: boolean;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ nullable: true }) visualColor!: string | null;
  @ApiProperty({ nullable: true }) icon!: string | null;

  static fromRecord(record: ManeuverErrorRecord): ManeuverErrorResponseDto {
    return Object.assign(new ManeuverErrorResponseDto(), record);
  }
}

export class SimulationSessionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() studentId!: string;
  @ApiProperty({ enum: LicenseCategory }) licenseCategory!: LicenseCategory;
  @ApiProperty({ enum: SimulationSessionStatus })
  status!: SimulationSessionStatus;
  @ApiProperty() totalScenarios!: number;
  @ApiProperty() correctCount!: number;
  @ApiProperty({ nullable: true }) score!: number | null;
  @ApiProperty({ nullable: true }) isPassed!: boolean | null;
  @ApiProperty() startedAt!: Date;
  @ApiProperty({ nullable: true }) completedAt!: Date | null;

  static fromRecord(
    record: SimulationSessionRecord,
  ): SimulationSessionResponseDto {
    return Object.assign(new SimulationSessionResponseDto(), record);
  }
}

export class SimulationAnswerResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() sessionId!: string;
  @ApiProperty() scenarioId!: string;
  @ApiProperty({ nullable: true }) selectedOptionId!: string | null;
  @ApiProperty({ nullable: true }) isCorrect!: boolean | null;
  @ApiProperty() answeredAt!: Date;
}

export class SimulationSessionResultResponseDto extends SimulationSessionResponseDto {
  @ApiProperty({ type: [SimulationAnswerResponseDto] })
  answers!: SimulationAnswerResponseDto[];

  static fromRecord(
    record: SimulationSessionResultRecord,
  ): SimulationSessionResultResponseDto {
    return Object.assign(new SimulationSessionResultResponseDto(), record);
  }
}

export class Practice2dFeedbackResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() telemetryType!: string;
  @ApiProperty({ nullable: true }) errorCode!: string | null;
  @ApiProperty({ enum: FeedbackSeverity }) severity!: FeedbackSeverity;
  @ApiProperty() penalty!: number;
  @ApiProperty() message!: string;
  @ApiProperty({ nullable: true }) hint!: string | null;
  @ApiProperty() occurredAt!: Date;

  static fromResult(
    result: Practice2dFeedbackResult,
  ): Practice2dFeedbackResponseDto {
    return Object.assign(new Practice2dFeedbackResponseDto(), result);
  }
}

export class Practice2dSessionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() studentId!: string;
  @ApiProperty({ enum: LicenseCategory }) licenseCategory!: string;
  @ApiProperty({ enum: Practice2dSessionStatus })
  status!: Practice2dSessionStatus | string;
  @ApiProperty() totalEvents!: number;
  @ApiProperty() errorCount!: number;
  @ApiProperty() totalPenalty!: number;
  @ApiProperty({ nullable: true }) score!: number | null;
  @ApiProperty() summary!: unknown;
  @ApiProperty() startedAt!: Date;
  @ApiProperty({ nullable: true }) endedAt!: Date | null;
  @ApiProperty({ type: [Practice2dFeedbackResponseDto] })
  feedbackEvents!: Practice2dFeedbackResponseDto[];

  static fromResult(
    result: Practice2dSessionResult,
  ): Practice2dSessionResponseDto {
    return Object.assign(new Practice2dSessionResponseDto(), result);
  }
}
