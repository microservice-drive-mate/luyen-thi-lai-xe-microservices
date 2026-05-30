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
  ManeuverErrorRecord,
  ManeuverRecord,
  SimulationSessionRecord,
} from '../../domain/repositories/simulation.repository';
import {
  Practice2dFeedbackResult,
  Practice2dSessionResult,
} from '../../application/use-cases/practice2d/practice2d.result';

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

export class ManeuverResponseDto {
  static fromRecord(record: ManeuverRecord): ManeuverResponseDto {
    return Object.assign(new ManeuverResponseDto(), record);
  }
}

export class ManeuverErrorResponseDto {
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

export class Practice2dFeedbackResponseDto {
  static fromResult(
    result: Practice2dFeedbackResult,
  ): Practice2dFeedbackResponseDto {
    return Object.assign(new Practice2dFeedbackResponseDto(), result);
  }
}

export class Practice2dSessionResponseDto {
  static fromResult(
    result: Practice2dSessionResult,
  ): Practice2dSessionResponseDto {
    return Object.assign(new Practice2dSessionResponseDto(), result);
  }
}
