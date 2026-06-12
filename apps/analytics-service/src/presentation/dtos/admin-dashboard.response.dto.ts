import { ApiProperty } from '@nestjs/swagger';
import {
  AdminDashboard,
  DashboardActivityType,
  DashboardCardKey,
  DashboardDeltaDirection,
} from '../../domain/dashboard/admin-dashboard.types';

export class DashboardPeriodDto {
  @ApiProperty() month!: string;
  @ApiProperty() currentFrom!: Date;
  @ApiProperty() currentTo!: Date;
  @ApiProperty() previousFrom!: Date;
  @ApiProperty() previousTo!: Date;
}

export class DashboardDeltaDto {
  @ApiProperty() value!: number;
  @ApiProperty({ nullable: true }) percentage!: number | null;
  @ApiProperty({ enum: ['up', 'down', 'flat'] })
  direction!: DashboardDeltaDirection;
}

export class DashboardCardDto {
  @ApiProperty({
    enum: ['students', 'courses', 'instructors', 'completedExams'],
  })
  key!: DashboardCardKey;
  @ApiProperty() label!: string;
  @ApiProperty() value!: number;
  @ApiProperty() previousValue!: number;
  @ApiProperty({ type: DashboardDeltaDto }) delta!: DashboardDeltaDto;
}

export class MonthlyTrendDto {
  @ApiProperty() month!: string;
  @ApiProperty() students!: number;
  @ApiProperty() completedExams!: number;
  @ApiProperty() passedExams!: number;
}

export class LicenseDistributionDto {
  @ApiProperty() licenseCategory!: string;
  @ApiProperty() students!: number;
  @ApiProperty() percentage!: number;
}

export class PassRateByLicenseDto {
  @ApiProperty() licenseCategory!: string;
  @ApiProperty() completedExams!: number;
  @ApiProperty() passedExams!: number;
  @ApiProperty() passRate!: number;
}

export class RecentActivityDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['student', 'course', 'exam', 'audit'] })
  type!: DashboardActivityType;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ required: false }) actorId?: string;
  @ApiProperty({ required: false }) actorName?: string;
  @ApiProperty({ required: false }) resourceType?: string;
  @ApiProperty({ required: false }) resourceId?: string;
  @ApiProperty({ required: false }) licenseCategory?: string;
  @ApiProperty() occurredAt!: Date;
}

export class AdminDashboardResponseDto {
  @ApiProperty({ type: DashboardPeriodDto }) period!: DashboardPeriodDto;
  @ApiProperty({ type: [DashboardCardDto] }) cards!: DashboardCardDto[];
  @ApiProperty({ type: [MonthlyTrendDto] }) monthlyTrend!: MonthlyTrendDto[];
  @ApiProperty({ type: [LicenseDistributionDto] })
  licenseDistribution!: LicenseDistributionDto[];
  @ApiProperty({ type: [PassRateByLicenseDto] })
  passRateByLicense!: PassRateByLicenseDto[];
  @ApiProperty({ type: [RecentActivityDto] })
  recentActivities!: RecentActivityDto[];

  static fromDashboard(result: AdminDashboard): AdminDashboardResponseDto {
    return Object.assign(new AdminDashboardResponseDto(), result);
  }
}
