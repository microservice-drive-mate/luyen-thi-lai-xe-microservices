export type DashboardCardKey =
  | 'students'
  | 'courses'
  | 'instructors'
  | 'completedExams';

export type DashboardDeltaDirection = 'up' | 'down' | 'flat';
export type DashboardActivityType = 'student' | 'course' | 'exam' | 'audit';

export interface DashboardPeriod {
  month: string;
  currentFrom: Date;
  currentTo: Date;
  previousFrom: Date;
  previousTo: Date;
}

export interface DashboardDelta {
  value: number;
  percentage: number | null;
  direction: DashboardDeltaDirection;
}

export interface DashboardCard {
  key: DashboardCardKey;
  label: string;
  value: number;
  previousValue: number;
  delta: DashboardDelta;
}

export interface DashboardMonthlyTrendPoint {
  month: string;
  students: number;
  completedExams: number;
  passedExams: number;
}

export interface DashboardLicenseDistributionItem {
  licenseCategory: string;
  students: number;
  percentage: number;
}

export interface DashboardPassRateItem {
  licenseCategory: string;
  completedExams: number;
  passedExams: number;
  passRate: number;
}

export interface DashboardRecentActivity {
  id: string;
  type: DashboardActivityType;
  title: string;
  description: string;
  actorId?: string;
  actorName?: string;
  resourceType?: string;
  resourceId?: string;
  licenseCategory?: string;
  occurredAt: Date;
}

export interface AdminDashboard {
  period: DashboardPeriod;
  cards: DashboardCard[];
  monthlyTrend: DashboardMonthlyTrendPoint[];
  licenseDistribution: DashboardLicenseDistributionItem[];
  passRateByLicense: DashboardPassRateItem[];
  recentActivities: DashboardRecentActivity[];
}

export interface DashboardRawCounts {
  currentStudents: number;
  previousStudents: number;
  currentCourses: number;
  previousCourses: number;
  currentInstructors: number;
  previousInstructors: number;
  currentCompletedExams: number;
  previousCompletedExams: number;
}

export interface DashboardUserProjectionInput {
  userId: string;
  fullName?: string | null;
  email?: string | null;
  role: string;
  isActive: boolean;
  licenseTier?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardCourseProjectionInput {
  courseId: string;
  title?: string | null;
  licenseCategory: string;
  status: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardExamCompletedInput {
  sessionId: string;
  studentId: string;
  licenseCategory: string;
  score?: number | null;
  isPassed: boolean;
  completedAt: Date;
}

export interface DashboardActivityInput {
  eventId: string;
  type: DashboardActivityType;
  title: string;
  description: string;
  actorId?: string | null;
  actorName?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  licenseCategory?: string | null;
  occurredAt: Date;
}

export interface DashboardProcessedEventInput {
  eventId: string;
  eventName: string;
}
