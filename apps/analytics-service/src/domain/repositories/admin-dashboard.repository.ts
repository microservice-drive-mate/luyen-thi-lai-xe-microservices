import {
  AdminDashboard,
  DashboardActivityInput,
  DashboardCourseProjectionInput,
  DashboardExamCompletedInput,
  DashboardPeriod,
  DashboardProcessedEventInput,
  DashboardUserProjectionInput,
} from '../dashboard/admin-dashboard.types';

export abstract class AdminDashboardRepository {
  abstract getDashboard(period: DashboardPeriod): Promise<AdminDashboard>;
  abstract upsertUserProjection(
    input: DashboardUserProjectionInput,
  ): Promise<void>;
  abstract upsertCourseProjection(
    input: DashboardCourseProjectionInput,
  ): Promise<void>;
  abstract recordExamCompleted(
    input: DashboardExamCompletedInput,
  ): Promise<void>;
  abstract recordActivity(input: DashboardActivityInput): Promise<void>;
  abstract hasProcessedEvent(eventId: string): Promise<boolean>;
  abstract markProcessedEvent(
    input: DashboardProcessedEventInput,
  ): Promise<void>;
}
