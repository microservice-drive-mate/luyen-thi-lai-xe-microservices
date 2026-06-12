import {
  DashboardActivityInput,
  DashboardCourseProjectionInput,
  DashboardExamCompletedInput,
  DashboardUserProjectionInput,
} from '../../../domain/dashboard/admin-dashboard.types';

export type RecordDashboardEventCommand =
  | {
      eventId: string;
      eventName: string;
      user?: DashboardUserProjectionInput;
      activity?: DashboardActivityInput;
    }
  | {
      eventId: string;
      eventName: string;
      course?: DashboardCourseProjectionInput;
      activity?: DashboardActivityInput;
    }
  | {
      eventId: string;
      eventName: string;
      exam?: DashboardExamCompletedInput;
      activity?: DashboardActivityInput;
    }
  | {
      eventId: string;
      eventName: string;
      activity: DashboardActivityInput;
    };
