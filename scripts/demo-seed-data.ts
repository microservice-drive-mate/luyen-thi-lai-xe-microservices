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
  enrollment: (courseSlug: string, studentId: string) =>
    deterministicUuid(`demo-course-${courseSlug}-enrollment-${studentId}`),
  examTemplate: (slug: string) =>
    deterministicUuid(`demo-exam-template-${slug}`),
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

export function allDemoUsers() {
  return [
    DEMO_USERS.admin,
    DEMO_USERS.centerManager,
    ...DEMO_USERS.instructors,
    ...DEMO_USERS.students,
  ];
}
