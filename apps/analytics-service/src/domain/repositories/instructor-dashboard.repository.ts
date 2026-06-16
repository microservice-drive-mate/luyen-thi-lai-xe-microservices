import {
  InstructorCourseProjectionInput,
  InstructorDashboard,
  InstructorDashboardQueryPeriod,
  InstructorEnrollmentProjectionInput,
  InstructorExamProjectionInput,
  InstructorScheduleProjectionInput,
} from '../dashboard/instructor-dashboard.types';

export abstract class InstructorDashboardRepository {
  abstract getDashboard(
    instructorId: string,
    period: InstructorDashboardQueryPeriod,
  ): Promise<InstructorDashboard>;
  abstract upsertCourseProjection(
    input: InstructorCourseProjectionInput,
  ): Promise<void>;
  abstract upsertEnrollmentProjection(
    input: InstructorEnrollmentProjectionInput,
  ): Promise<void>;
  abstract upsertScheduleProjection(
    input: InstructorScheduleProjectionInput,
  ): Promise<void>;
  abstract deactivateSchedule(scheduleId: string): Promise<void>;
  abstract recordExamCompleted(
    input: InstructorExamProjectionInput,
  ): Promise<void>;
}
