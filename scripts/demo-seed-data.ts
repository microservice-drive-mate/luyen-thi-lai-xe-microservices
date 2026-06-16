import { createHash } from 'node:crypto';

export function deterministicUuid(input: string): string {
  const bytes = createHash('sha1').update(input).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16,
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const DEMO_USERS = {
  admin: {
    id: '10000000-0000-0000-0000-000000000001',
    email: 'admin@test.com',
    fullName: 'Quản trị viên thử nghiệm',
    role: 'ADMIN',
  },
  centerManager: {
    id: deterministicUuid('demo-center-manager-01'),
    email: 'manager@test.com',
    fullName: 'Quản lý trung tâm Demo',
    role: 'CENTER_MANAGER',
  },
  instructors: [
    {
      id: deterministicUuid('demo-instructor-01'),
      email: 'instructor.b1@test.com',
      fullName: 'Giáo viên hướng dẫn B1 Demo',
      role: 'INSTRUCTOR',
    },
    {
      id: deterministicUuid('demo-instructor-02'),
      email: 'instructor.b2@test.com',
      fullName: 'Giáo viên hướng dẫn B2 Demo',
      role: 'INSTRUCTOR',
    },
  ],
  students: [
    {
      id: deterministicUuid('demo-student-a1-01'),
      email: 'student.a1@test.com',
      fullName: 'Học viên A1 Demo',
      role: 'STUDENT',
      licenseTier: 'A1',
      progressSeed: 'active',
    },
    {
      id: deterministicUuid('demo-student-b1-01'),
      email: 'student.b1@test.com',
      fullName: 'Học viên B1 Demo',
      role: 'STUDENT',
      licenseTier: 'B1',
      progressSeed: 'strong',
    },
    {
      id: deterministicUuid('demo-student-b1-02'),
      email: 'student.b1.low@test.com',
      fullName: 'Học viên B1 điểm thấp Demo',
      role: 'STUDENT',
      licenseTier: 'B1',
      progressSeed: 'risk',
    },
    {
      id: deterministicUuid('demo-student-b2-01'),
      email: 'student.b2@test.com',
      fullName: 'Học viên B2 Demo',
      role: 'STUDENT',
      licenseTier: 'B2',
      progressSeed: 'completed',
    },
    {
      id: deterministicUuid('demo-student-b2-02'),
      email: 'student.b2.new@test.com',
      fullName: 'Học viên B2 mới Demo',
      role: 'STUDENT',
      licenseTier: 'B2',
      progressSeed: 'new',
    },
  ],
} as const;

export const DEMO_PASSWORD = '123456';

export const DEMO_TOPIC_IDS = [
  deterministicUuid('bca-600-topic-1'),
  deterministicUuid('bca-600-topic-2'),
  deterministicUuid('bca-600-topic-3'),
  deterministicUuid('bca-600-topic-4'),
  deterministicUuid('bca-600-topic-5'),
  deterministicUuid('bca-600-topic-6'),
] as const;

export const DEMO_TOPIC_NAMES = [
  'Quy định chung và quy tắc giao thông đường bộ',
  'Văn hóa giao thông và đạo đức người lái xe',
  'Kỹ thuật lái xe',
  'Cấu tạo và sửa chữa',
  'Báo hiệu đường bộ',
  'Giải thế sa hình và xử lý tình huống',
] as const;

export const DEMO_IDS = {
  course: (slug: string) => deterministicUuid(`demo-course-${slug}`),
  lesson: (courseSlug: string, order: number) =>
    deterministicUuid(`demo-course-${courseSlug}-lesson-${order}`),
  material: (courseSlug: string, order: number) =>
    deterministicUuid(`demo-course-${courseSlug}-material-${order}`),
  requirement: (courseSlug: string) =>
    deterministicUuid(`demo-course-${courseSlug}-requirement`),
  instructor: (courseSlug: string, instructorId: string) =>
    deterministicUuid(`demo-course-${courseSlug}-instructor-${instructorId}`),
  schedule: (courseSlug: string, index: number) =>
    deterministicUuid(`demo-course-${courseSlug}-schedule-${index}`),
  enrollment: (courseSlug: string, studentId: string) =>
    deterministicUuid(`demo-course-${courseSlug}-enrollment-${studentId}`),
  examTemplate: (slug: string) =>
    deterministicUuid(`demo-exam-template-${slug}`),
  examSession: (studentId: string, attemptIndex: number) =>
    deterministicUuid(`demo-exam-session-${studentId}-${attemptIndex}`),
  topicAttempt: (
    sessionId: string,
    topicIndex: number,
    questionIndex: number,
  ) =>
    deterministicUuid(
      `demo-topic-attempt-${sessionId}-${topicIndex}-${questionIndex}`,
    ),
  dashboardActivity: (slug: string) =>
    deterministicUuid(`demo-dashboard-activity-${slug}`),
  analyticsActivity: (studentId: string, day: string) =>
    deterministicUuid(`demo-analytics-activity-${studentId}-${day}`),
  accuracy: (studentId: string, questionId: string) =>
    deterministicUuid(`demo-analytics-accuracy-${studentId}-${questionId}`),
  warning: (studentId: string) =>
    deterministicUuid(`demo-warning-${studentId}`),
  notification: (studentId: string, slug: string) =>
    deterministicUuid(`demo-notification-${studentId}-${slug}`),
  maneuver: (slug: string) => deterministicUuid(`demo-maneuver-${slug}`),
  checkpoint: (maneuverSlug: string, order: number) =>
    deterministicUuid(`demo-maneuver-${maneuverSlug}-checkpoint-${order}`),
  maneuverError: (licenseCategory: string, code: string) =>
    deterministicUuid(`demo-maneuver-error-${licenseCategory}-${code}`),
  simulationSession: (studentId: string, slug: string) =>
    deterministicUuid(`demo-simulation-session-${studentId}-${slug}`),
  simulationAnswer: (sessionId: string, scenarioId: string) =>
    deterministicUuid(`demo-simulation-answer-${sessionId}-${scenarioId}`),
  mediaFile: (slug: string) => deterministicUuid(`demo-media-file-${slug}`),
};

export const DEMO_COURSES = [
  {
    slug: 'a1-basic',
    title: 'Khóa A1 cơ bản',
    licenseCategory: 'A1',
    status: 'ACTIVE',
  },
  {
    slug: 'a1-practice',
    title: 'Khóa A1 luyện đề',
    licenseCategory: 'A1',
    status: 'ACTIVE',
  },
  {
    slug: 'b1-basic',
    title: 'Khóa B1 cơ bản',
    licenseCategory: 'B1',
    status: 'ACTIVE',
  },
  {
    slug: 'b1-intensive',
    title: 'Khóa B1 cấp tốc',
    licenseCategory: 'B1',
    status: 'ACTIVE',
  },
  {
    slug: 'b2-basic',
    title: 'Khóa B2 cơ bản',
    licenseCategory: 'B2',
    status: 'ACTIVE',
  },
  {
    slug: 'b2-advanced',
    title: 'Khóa B2 nâng cao',
    licenseCategory: 'B2',
    status: 'ACTIVE',
  },
  {
    slug: 'b2-draft',
    title: 'Khóa B2 sắp khai giảng',
    licenseCategory: 'B2',
    status: 'DRAFT',
  },
  {
    slug: 'b1-archived',
    title: 'Khóa B1 cũ',
    licenseCategory: 'B1',
    status: 'ARCHIVED',
  },
] as const;

export function demoInstructorIdsForCourse(courseSlug: string): string[] {
  if (courseSlug.startsWith('b2')) return [DEMO_USERS.instructors[1].id];
  return [DEMO_USERS.instructors[0].id];
}

export const DEMO_COURSE_ENROLLMENTS = [
  {
    courseSlug: 'a1-basic',
    studentIndex: 0,
    progress: 45,
    status: 'ACTIVE',
  },
  {
    courseSlug: 'b1-basic',
    studentIndex: 1,
    progress: 75,
    status: 'ACTIVE',
  },
  {
    courseSlug: 'b1-intensive',
    studentIndex: 2,
    progress: 25,
    status: 'ACTIVE',
  },
  {
    courseSlug: 'b2-basic',
    studentIndex: 3,
    progress: 100,
    status: 'COMPLETED',
  },
  {
    courseSlug: 'b2-advanced',
    studentIndex: 4,
    progress: 10,
    status: 'ACTIVE',
  },
] as const;

export const DEMO_COURSE_SCHEDULES = [
  {
    courseSlug: 'a1-basic',
    dayOfWeek: 1,
    startTime: '07:00',
    endTime: '09:00',
    room: 'Phong 101',
  },
  {
    courseSlug: 'a1-basic',
    dayOfWeek: 3,
    startTime: '07:00',
    endTime: '09:00',
    room: 'Phong 101',
  },
  {
    courseSlug: 'a1-basic',
    dayOfWeek: 5,
    startTime: '07:00',
    endTime: '09:00',
    room: 'Phong 101',
  },
  {
    courseSlug: 'a1-practice',
    dayOfWeek: 2,
    startTime: '09:00',
    endTime: '11:00',
    room: 'Phong 102',
  },
  {
    courseSlug: 'a1-practice',
    dayOfWeek: 4,
    startTime: '09:00',
    endTime: '11:00',
    room: 'Phong 102',
  },
  {
    courseSlug: 'b1-basic',
    dayOfWeek: 1,
    startTime: '14:00',
    endTime: '16:00',
    room: 'Phong 201',
  },
  {
    courseSlug: 'b1-basic',
    dayOfWeek: 3,
    startTime: '14:00',
    endTime: '16:00',
    room: 'Phong 201',
  },
  {
    courseSlug: 'b1-basic',
    dayOfWeek: 5,
    startTime: '14:00',
    endTime: '16:00',
    room: 'Phong 201',
  },
  {
    courseSlug: 'b1-intensive',
    dayOfWeek: 2,
    startTime: '18:00',
    endTime: '20:00',
    room: 'Phong 202',
  },
  {
    courseSlug: 'b1-intensive',
    dayOfWeek: 4,
    startTime: '18:00',
    endTime: '20:00',
    room: 'Phong 202',
  },
  {
    courseSlug: 'b1-intensive',
    dayOfWeek: 6,
    startTime: '18:00',
    endTime: '20:00',
    room: 'Phong 202',
  },
  {
    courseSlug: 'b2-basic',
    dayOfWeek: 2,
    startTime: '14:00',
    endTime: '16:00',
    room: 'Phong 301',
  },
  {
    courseSlug: 'b2-basic',
    dayOfWeek: 4,
    startTime: '14:00',
    endTime: '16:00',
    room: 'Phong 301',
  },
  {
    courseSlug: 'b2-basic',
    dayOfWeek: 6,
    startTime: '14:00',
    endTime: '16:00',
    room: 'Phong 301',
  },
  {
    courseSlug: 'b2-advanced',
    dayOfWeek: 1,
    startTime: '18:00',
    endTime: '20:00',
    room: 'Phong 302',
  },
  {
    courseSlug: 'b2-advanced',
    dayOfWeek: 3,
    startTime: '18:00',
    endTime: '20:00',
    room: 'Phong 302',
  },
  {
    courseSlug: 'b2-advanced',
    dayOfWeek: 5,
    startTime: '18:00',
    endTime: '20:00',
    room: 'Phong 302',
  },
] as const;

export const DEMO_EXAM_ATTEMPTS = [
  {
    studentIndex: 0,
    licenseCategory: 'A1',
    score: 68,
    isPassed: false,
    completedAt: '2026-06-03T08:30:00.000Z',
    topicResults: [
      { topicIndex: 0, answered: 5, correct: 3 },
      { topicIndex: 4, answered: 5, correct: 2 },
      { topicIndex: 5, answered: 5, correct: 5 },
    ],
  },
  {
    studentIndex: 0,
    licenseCategory: 'A1',
    score: 86,
    isPassed: true,
    completedAt: '2026-06-10T08:30:00.000Z',
    topicResults: [
      { topicIndex: 0, answered: 5, correct: 4 },
      { topicIndex: 4, answered: 5, correct: 5 },
      { topicIndex: 5, answered: 5, correct: 4 },
    ],
  },
  {
    studentIndex: 1,
    licenseCategory: 'B1',
    score: 88,
    isPassed: true,
    completedAt: '2026-06-04T15:30:00.000Z',
    topicResults: [
      { topicIndex: 0, answered: 6, correct: 5 },
      { topicIndex: 2, answered: 6, correct: 5 },
      { topicIndex: 4, answered: 6, correct: 6 },
    ],
  },
  {
    studentIndex: 1,
    licenseCategory: 'B1',
    score: 91,
    isPassed: true,
    completedAt: '2026-06-11T15:30:00.000Z',
    topicResults: [
      { topicIndex: 0, answered: 6, correct: 6 },
      { topicIndex: 2, answered: 6, correct: 5 },
      { topicIndex: 5, answered: 6, correct: 5 },
    ],
  },
  {
    studentIndex: 2,
    licenseCategory: 'B1',
    score: 54,
    isPassed: false,
    completedAt: '2026-06-05T19:30:00.000Z',
    topicResults: [
      { topicIndex: 0, answered: 6, correct: 3 },
      { topicIndex: 4, answered: 6, correct: 2 },
      { topicIndex: 5, answered: 6, correct: 2 },
    ],
  },
  {
    studentIndex: 2,
    licenseCategory: 'B1',
    score: 62,
    isPassed: false,
    completedAt: '2026-06-12T19:30:00.000Z',
    topicResults: [
      { topicIndex: 0, answered: 6, correct: 4 },
      { topicIndex: 4, answered: 6, correct: 3 },
      { topicIndex: 5, answered: 6, correct: 2 },
    ],
  },
  {
    studentIndex: 3,
    licenseCategory: 'B2',
    score: 92,
    isPassed: true,
    completedAt: '2026-06-06T15:30:00.000Z',
    topicResults: [
      { topicIndex: 0, answered: 7, correct: 6 },
      { topicIndex: 2, answered: 7, correct: 7 },
      { topicIndex: 4, answered: 7, correct: 6 },
    ],
  },
  {
    studentIndex: 3,
    licenseCategory: 'B2',
    score: 89,
    isPassed: true,
    completedAt: '2026-06-13T15:30:00.000Z',
    topicResults: [
      { topicIndex: 0, answered: 7, correct: 6 },
      { topicIndex: 2, answered: 7, correct: 6 },
      { topicIndex: 5, answered: 7, correct: 7 },
    ],
  },
  {
    studentIndex: 4,
    licenseCategory: 'B2',
    score: 57,
    isPassed: false,
    completedAt: '2026-06-09T19:30:00.000Z',
    topicResults: [
      { topicIndex: 0, answered: 7, correct: 4 },
      { topicIndex: 4, answered: 7, correct: 2 },
      { topicIndex: 5, answered: 7, correct: 3 },
    ],
  },
] as const;

export const DEMO_DASHBOARD_ACTIVITIES = [
  {
    slug: 'student-b1-enrolled',
    type: 'student',
    title: 'Student B1 Demo enrolled',
    description: 'course.enrollment.created',
    resourceType: 'COURSE_ENROLLMENT',
    resourceId: DEMO_IDS.enrollment('b1-basic', DEMO_USERS.students[1].id),
    occurredAt: '2026-06-13T09:15:00.000Z',
  },
  {
    slug: 'student-b2-completed',
    type: 'student',
    title: 'Student B2 Demo completed course',
    description: 'course.enrollment.completed',
    resourceType: 'COURSE_ENROLLMENT',
    resourceId: DEMO_IDS.enrollment('b2-basic', DEMO_USERS.students[3].id),
    occurredAt: '2026-06-13T08:45:00.000Z',
  },
  {
    slug: 'exam-b2-passed',
    type: 'exam',
    title: 'Student B2 Demo passed B2 exam',
    description: 'exam.session.completed',
    resourceType: 'EXAM_SESSION',
    resourceId: DEMO_IDS.examSession(DEMO_USERS.students[3].id, 2),
    occurredAt: '2026-06-13T08:30:00.000Z',
  },
  {
    slug: 'exam-b1-risk',
    type: 'exam',
    title: 'Student B1 Low Score Demo needs support',
    description: 'exam.session.completed',
    resourceType: 'EXAM_SESSION',
    resourceId: DEMO_IDS.examSession(DEMO_USERS.students[2].id, 2),
    occurredAt: '2026-06-12T19:30:00.000Z',
  },
  {
    slug: 'course-b1-updated',
    type: 'course',
    title: 'Khoa B1 co ban updated',
    description: 'course.updated',
    resourceType: 'COURSE',
    resourceId: DEMO_IDS.course('b1-basic'),
    occurredAt: '2026-06-12T10:00:00.000Z',
  },
  {
    slug: 'course-b2-schedule',
    type: 'course',
    title: 'Khoa B2 co ban schedule created',
    description: 'course.schedule.created',
    resourceType: 'COURSE',
    resourceId: DEMO_IDS.course('b2-basic'),
    occurredAt: '2026-06-11T10:00:00.000Z',
  },
  {
    slug: 'student-a1-license',
    type: 'student',
    title: 'Student A1 Demo assigned A1 license',
    description: 'user.student.license-assigned',
    resourceType: 'STUDENT',
    resourceId: DEMO_USERS.students[0].id,
    occurredAt: '2026-06-10T09:00:00.000Z',
  },
  {
    slug: 'audit-course-material',
    type: 'audit',
    title: 'Course material added',
    description: 'security.audit.recorded',
    resourceType: 'COURSE',
    resourceId: DEMO_IDS.course('a1-basic'),
    occurredAt: '2026-06-09T09:00:00.000Z',
  },
] as const;

export function allDemoUsers() {
  return [
    DEMO_USERS.admin,
    DEMO_USERS.centerManager,
    ...DEMO_USERS.instructors,
    ...DEMO_USERS.students,
  ];
}
