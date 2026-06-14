import { Injectable } from '@nestjs/common';
import {
  AdminDashboard,
  DashboardActivityInput,
  DashboardCourseProjectionInput,
  DashboardExamCompletedInput,
  DashboardLicenseDistributionItem,
  DashboardMonthlyTrendPoint,
  DashboardPassRateItem,
  DashboardPeriod,
  DashboardRecentActivity,
  DashboardRawCounts,
  DashboardUserProjectionInput,
} from '../../../domain/dashboard/admin-dashboard.types';
import {
  DashboardMetricCalculator,
  toMonthKey,
} from '../../../domain/dashboard/dashboard-metric.calculator';
import { AdminDashboardRepository } from '../../../domain/repositories/admin-dashboard.repository';
import { PrismaService } from './prisma.service';

const ACTIVE_COURSE_STATUSES = ['ACTIVE', 'DRAFT'];
const DASHBOARD_TREND_MONTHS = 6;

@Injectable()
export class PrismaAdminDashboardRepository extends AdminDashboardRepository {
  private readonly calculator = new DashboardMetricCalculator();

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async getDashboard(period: DashboardPeriod): Promise<AdminDashboard> {
    const trendStart = addMonths(
      period.currentFrom,
      -DASHBOARD_TREND_MONTHS + 1,
    );
    const [
      counts,
      trendRows,
      studentTrendRows,
      licenseRows,
      passRateRows,
      activityRows,
    ] = await Promise.all([
      this.getCounts(period),
      this.prisma.dashboardExamSessionProjection.groupBy({
        by: ['completedAt', 'isPassed'],
        where: { completedAt: { gte: trendStart, lt: period.currentTo } },
        _count: { _all: true },
      }),
      this.prisma.dashboardUserProjection.groupBy({
        by: ['createdAt'],
        where: {
          role: 'STUDENT',
          isActive: true,
          createdAt: { gte: trendStart, lt: period.currentTo },
        },
        _count: { _all: true },
      }),
      this.prisma.dashboardUserProjection.groupBy({
        by: ['licenseTier'],
        where: {
          role: 'STUDENT',
          isActive: true,
          licenseTier: { not: null },
        },
        _count: { _all: true },
      }),
      this.prisma.dashboardExamSessionProjection.groupBy({
        by: ['licenseCategory', 'isPassed'],
        where: {
          completedAt: { gte: period.currentFrom, lt: period.currentTo },
        },
        _count: { _all: true },
      }),
      this.prisma.dashboardRecentActivityProjection.findMany({
        orderBy: { occurredAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      period,
      cards: this.calculator.buildCards(counts),
      monthlyTrend: this.buildMonthlyTrend(period, trendRows, studentTrendRows),
      licenseDistribution: this.buildLicenseDistribution(licenseRows),
      passRateByLicense: this.buildPassRates(passRateRows),
      recentActivities: activityRows.map(toActivity),
    };
  }

  async upsertUserProjection(
    input: DashboardUserProjectionInput,
  ): Promise<void> {
    await this.prisma.dashboardUserProjection.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        fullName: input.fullName,
        email: input.email,
        role: input.role,
        isActive: input.isActive,
        licenseTier: input.licenseTier,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
      },
      update: {
        fullName: input.fullName,
        email: input.email,
        role: input.role,
        isActive: input.isActive,
        licenseTier: input.licenseTier,
        updatedAt: input.updatedAt,
      },
    });
  }

  async upsertCourseProjection(
    input: DashboardCourseProjectionInput,
  ): Promise<void> {
    await this.prisma.dashboardCourseProjection.upsert({
      where: { courseId: input.courseId },
      create: {
        courseId: input.courseId,
        title: input.title,
        licenseCategory: input.licenseCategory,
        status: input.status,
        isDeleted: input.isDeleted,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
      },
      update: {
        title: input.title,
        licenseCategory: input.licenseCategory,
        status: input.status,
        isDeleted: input.isDeleted,
        updatedAt: input.updatedAt,
      },
    });
  }

  async recordExamCompleted(input: DashboardExamCompletedInput): Promise<void> {
    await this.prisma.dashboardExamSessionProjection.upsert({
      where: { sessionId: input.sessionId },
      create: {
        sessionId: input.sessionId,
        studentId: input.studentId,
        licenseCategory: input.licenseCategory,
        score: input.score,
        isPassed: input.isPassed,
        completedAt: input.completedAt,
      },
      update: {
        studentId: input.studentId,
        licenseCategory: input.licenseCategory,
        score: input.score,
        isPassed: input.isPassed,
        completedAt: input.completedAt,
      },
    });
  }

  async recordActivity(input: DashboardActivityInput): Promise<void> {
    await this.prisma.dashboardRecentActivityProjection.upsert({
      where: { eventId: input.eventId },
      create: {
        eventId: input.eventId,
        type: input.type,
        title: input.title,
        description: input.description,
        actorId: input.actorId,
        actorName: input.actorName,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        licenseCategory: input.licenseCategory,
        occurredAt: input.occurredAt,
      },
      update: {
        type: input.type,
        title: input.title,
        description: input.description,
        actorId: input.actorId,
        actorName: input.actorName,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        licenseCategory: input.licenseCategory,
        occurredAt: input.occurredAt,
      },
    });
  }

  async hasProcessedEvent(eventId: string): Promise<boolean> {
    const count = await this.prisma.dashboardProcessedEvent.count({
      where: { eventId },
    });
    return count > 0;
  }

  async markProcessedEvent(input: {
    eventId: string;
    eventName: string;
  }): Promise<void> {
    await this.prisma.dashboardProcessedEvent.upsert({
      where: { eventId: input.eventId },
      create: { eventId: input.eventId, eventName: input.eventName },
      update: {},
    });
  }

  private async getCounts(
    period: DashboardPeriod,
  ): Promise<DashboardRawCounts> {
    const rows = await this.prisma.$queryRaw<DashboardRawCounts[]>`
      SELECT
        (SELECT COUNT(*)::int FROM dashboard_user_projections
          WHERE role = 'STUDENT' AND "isActive" = true AND "createdAt" < ${period.currentTo}) AS "currentStudents",
        (SELECT COUNT(*)::int FROM dashboard_user_projections
          WHERE role = 'STUDENT' AND "isActive" = true AND "createdAt" < ${period.previousTo}) AS "previousStudents",
        (SELECT COUNT(*)::int FROM dashboard_course_projections
          WHERE "isDeleted" = false AND status = ANY(${ACTIVE_COURSE_STATUSES}) AND "createdAt" < ${period.currentTo}) AS "currentCourses",
        (SELECT COUNT(*)::int FROM dashboard_course_projections
          WHERE "isDeleted" = false AND status = ANY(${ACTIVE_COURSE_STATUSES}) AND "createdAt" < ${period.previousTo}) AS "previousCourses",
        (SELECT COUNT(*)::int FROM dashboard_user_projections
          WHERE role = 'INSTRUCTOR' AND "isActive" = true AND "createdAt" < ${period.currentTo}) AS "currentInstructors",
        (SELECT COUNT(*)::int FROM dashboard_user_projections
          WHERE role = 'INSTRUCTOR' AND "isActive" = true AND "createdAt" < ${period.previousTo}) AS "previousInstructors",
        (SELECT COUNT(*)::int FROM dashboard_exam_session_projections
          WHERE "completedAt" >= ${period.currentFrom} AND "completedAt" < ${period.currentTo}) AS "currentCompletedExams",
        (SELECT COUNT(*)::int FROM dashboard_exam_session_projections
          WHERE "completedAt" >= ${period.previousFrom} AND "completedAt" < ${period.previousTo}) AS "previousCompletedExams"
    `;
    return rows[0] ?? emptyCounts();
  }

  private buildMonthlyTrend(
    period: DashboardPeriod,
    rows: Array<{
      completedAt: Date;
      isPassed: boolean;
      _count: { _all: number };
    }>,
    studentRows: Array<{
      createdAt: Date;
      _count: { _all: number };
    }>,
  ): DashboardMonthlyTrendPoint[] {
    const trend = new Map(
      this.calculator
        .emptyTrend(period, DASHBOARD_TREND_MONTHS)
        .map((point) => [point.month, point]),
    );

    for (const row of rows) {
      const month = toMonthKey(row.completedAt);
      const point = trend.get(month);
      if (!point) continue;
      point.completedExams += row._count._all;
      if (row.isPassed) {
        point.passedExams += row._count._all;
      }
    }

    for (const row of studentRows) {
      const month = toMonthKey(row.createdAt);
      const point = trend.get(month);
      if (!point) continue;
      point.students += row._count._all;
    }

    return [...trend.values()];
  }

  private buildLicenseDistribution(
    rows: Array<{ licenseTier: string | null; _count: { _all: number } }>,
  ): DashboardLicenseDistributionItem[] {
    const total = rows.reduce((sum, row) => sum + row._count._all, 0);
    return rows
      .filter((row) => row.licenseTier)
      .map((row) => ({
        licenseCategory: row.licenseTier ?? '',
        students: row._count._all,
        percentage: this.calculator.percentage(row._count._all, total),
      }))
      .sort((a, b) => a.licenseCategory.localeCompare(b.licenseCategory));
  }

  private buildPassRates(
    rows: Array<{
      licenseCategory: string;
      isPassed: boolean;
      _count: { _all: number };
    }>,
  ): DashboardPassRateItem[] {
    const grouped = new Map<
      string,
      { completedExams: number; passedExams: number }
    >();
    for (const row of rows) {
      const item = grouped.get(row.licenseCategory) ?? {
        completedExams: 0,
        passedExams: 0,
      };
      item.completedExams += row._count._all;
      if (row.isPassed) {
        item.passedExams += row._count._all;
      }
      grouped.set(row.licenseCategory, item);
    }

    return [...grouped.entries()]
      .map(([licenseCategory, item]) => ({
        licenseCategory,
        completedExams: item.completedExams,
        passedExams: item.passedExams,
        passRate: this.calculator.passRate(
          item.passedExams,
          item.completedExams,
        ),
      }))
      .sort((a, b) => a.licenseCategory.localeCompare(b.licenseCategory));
  }
}

function toActivity(record: {
  id: string;
  type: string;
  title: string;
  description: string;
  actorId: string | null;
  actorName: string | null;
  resourceType: string | null;
  resourceId: string | null;
  licenseCategory: string | null;
  occurredAt: Date;
}): DashboardRecentActivity {
  return {
    id: record.id,
    type: record.type as DashboardRecentActivity['type'],
    title: record.title,
    description: record.description,
    actorId: record.actorId ?? undefined,
    actorName: record.actorName ?? undefined,
    resourceType: record.resourceType ?? undefined,
    resourceId: record.resourceId ?? undefined,
    licenseCategory: record.licenseCategory ?? undefined,
    occurredAt: record.occurredAt,
  };
}

function addMonths(value: Date, months: number): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1),
  );
}

function emptyCounts(): DashboardRawCounts {
  return {
    currentStudents: 0,
    previousStudents: 0,
    currentCourses: 0,
    previousCourses: 0,
    currentInstructors: 0,
    previousInstructors: 0,
    currentCompletedExams: 0,
    previousCompletedExams: 0,
  };
}
