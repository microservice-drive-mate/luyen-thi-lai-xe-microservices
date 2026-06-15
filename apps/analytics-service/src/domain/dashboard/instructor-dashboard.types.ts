export interface InstructorDashboardPeriod {
  month: string;
  weekStart: string;
  date: string;
  timezone: string;
}

export interface InstructorDashboardSummary {
  activeClassCount: number;
  totalStudents: number;
  passRate: number;
  teachingHoursThisMonth: number;
}

export interface InstructorWeeklyTeachingTrendPoint {
  date: string;
  label: string;
  teachingHours: number;
  studentCount: number;
}

export interface InstructorTopicAverage {
  topicId: string | null;
  topicName: string | null;
  averageScore: number;
  answeredQuestions: number;
}

export interface InstructorClassProgress {
  courseId: string;
  title: string;
  licenseCategory: string;
  totalStudents: number;
  completedStudents: number;
  progressPct: number;
  students: InstructorCourseStudent[];
}

export interface InstructorCourseStudent {
  studentId: string;
  fullName: string | null;
  email: string | null;
  licenseTier: string | null;
  status: string;
  progress: number;
  enrolledAt: Date | null;
  completedAt: Date | null;
}

export interface InstructorTodayScheduleItem {
  scheduleId: string;
  courseId: string;
  title: string;
  room: string | null;
  startTime: string;
  endTime: string;
  studentCount: number;
}

export interface InstructorDashboard {
  period: InstructorDashboardPeriod;
  summary: InstructorDashboardSummary;
  weeklyTeachingTrend: InstructorWeeklyTeachingTrendPoint[];
  topicAverages: InstructorTopicAverage[];
  classProgress: InstructorClassProgress[];
  todaySchedule: InstructorTodayScheduleItem[];
}

export interface InstructorDashboardQueryPeriod {
  month: string;
  monthFrom: Date;
  monthTo: Date;
  weekStart: Date;
  weekEnd: Date;
  date: Date;
  timezone: string;
}

export interface InstructorCourseProjectionInput {
  courseId: string;
  title?: string | null;
  licenseCategory: string;
  status: string;
  isDeleted: boolean;
  capacity?: number | null;
  totalLessons?: number;
  instructorIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InstructorEnrollmentProjectionInput {
  enrollmentId: string;
  courseId: string;
  studentId: string;
  status: string;
  progress: number;
  enrolledAt?: Date | null;
  completedAt?: Date | null;
}

export interface InstructorScheduleProjectionInput {
  scheduleId: string;
  courseId: string;
  instructorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string | null;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  isActive: boolean;
}

export interface InstructorExamProjectionInput {
  sessionId: string;
  studentId: string;
  score?: number | null;
  isPassed: boolean;
  completedAt: Date;
  questions?: Array<{
    questionId: string;
    topicId?: string | null;
    topicName?: string | null;
    isCorrect?: boolean | null;
  }>;
}
