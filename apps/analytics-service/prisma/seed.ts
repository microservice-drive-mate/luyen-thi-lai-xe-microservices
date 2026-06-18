import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/analytics-client';
import {
  allDemoUsers,
  DEMO_COURSE_ENROLLMENTS,
  DEMO_COURSE_SCHEDULES,
  DEMO_COURSES,
  DEMO_DASHBOARD_ACTIVITIES,
  DEMO_EXAM_ATTEMPTS,
  DEMO_IDS,
  DEMO_TOPIC_IDS,
  DEMO_TOPIC_NAMES,
  DEMO_USERS,
  demoInstructorIdsForCourse,
  deterministicUuid,
} from '../../../scripts/demo-seed-data';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed analytics data');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const profilePresets = {
  active: {
    study: 90,
    attempts: 2,
    passed: 1,
    avg: 78,
    enrolled: 1,
    completed: 0,
  },
  strong: {
    study: 180,
    attempts: 4,
    passed: 3,
    avg: 86,
    enrolled: 1,
    completed: 0,
  },
  risk: {
    study: 70,
    attempts: 3,
    passed: 0,
    avg: 58,
    enrolled: 1,
    completed: 0,
  },
  completed: {
    study: 240,
    attempts: 5,
    passed: 4,
    avg: 88,
    enrolled: 1,
    completed: 1,
  },
  new: { study: 20, attempts: 0, passed: 0, avg: 0, enrolled: 1, completed: 0 },
};

function utcDate(day: number): Date {
  return new Date(Date.UTC(2026, 4, day));
}

async function seedDailyActivity(
  studentId: string,
  preset: keyof typeof profilePresets,
) {
  const base = profilePresets[preset];

  for (let offset = 0; offset < 7; offset += 1) {
    const day = 15 + offset;
    const date = utcDate(day);
    const examsAttempted = base.attempts > 0 && offset % 3 === 0 ? 1 : 0;
    const questionsAnswered = examsAttempted ? 30 : 0;
    const correctAnswers =
      examsAttempted && base.avg > 0
        ? Math.round((base.avg / 100) * questionsAnswered)
        : 0;

    await prisma.dailyActivity.upsert({
      where: { studentId_date: { studentId, date } },
      update: {
        studyMinutes: Math.max(5, Math.round(base.study / 7) + offset),
        examsAttempted,
        questionsAnswered,
        correctAnswers,
      },
      create: {
        id: DEMO_IDS.analyticsActivity(
          studentId,
          date.toISOString().slice(0, 10),
        ),
        studentId,
        date,
        studyMinutes: Math.max(5, Math.round(base.study / 7) + offset),
        examsAttempted,
        questionsAnswered,
        correctAnswers,
      },
    });
  }
}

async function seedWeakTopics(
  studentId: string,
  preset: keyof typeof profilePresets,
) {
  if (preset === 'new') return;

  for (let index = 0; index < 4; index += 1) {
    const questionId = deterministicUuid(`bca-600-question-${301 + index}`);
    const totalAttempts = preset === 'risk' ? 5 + index : 3 + index;
    const correctAttempts =
      preset === 'risk' ? 1 : Math.max(1, totalAttempts - 2);

    await prisma.questionAccuracyTracker.upsert({
      where: { studentId_questionId: { studentId, questionId } },
      update: {
        topicId: DEMO_TOPIC_IDS[(index + 4) % DEMO_TOPIC_IDS.length],
        topicName: DEMO_TOPIC_NAMES[(index + 4) % DEMO_TOPIC_NAMES.length],
        totalAttempts,
        correctAttempts,
        lastAttemptAt: new Date('2026-05-21T08:00:00.000Z'),
      },
      create: {
        id: DEMO_IDS.accuracy(studentId, questionId),
        studentId,
        questionId,
        topicId: DEMO_TOPIC_IDS[(index + 4) % DEMO_TOPIC_IDS.length],
        topicName: DEMO_TOPIC_NAMES[(index + 4) % DEMO_TOPIC_NAMES.length],
        totalAttempts,
        correctAttempts,
        lastAttemptAt: new Date('2026-05-21T08:00:00.000Z'),
      },
    });
  }
}

function courseDate(courseSlug: string): Date {
  const index = DEMO_COURSES.findIndex((course) => course.slug === courseSlug);
  return new Date(Date.UTC(2026, 4, 1 + Math.max(index, 0)));
}

function userDate(userId: string): Date {
  const index = allDemoUsers().findIndex((user) => user.id === userId);
  return new Date(Date.UTC(2026, 4, 1 + Math.max(index, 0)));
}

function examSessionIds(): string[] {
  const counts = new Map<string, number>();
  return DEMO_EXAM_ATTEMPTS.map((attempt) => {
    const studentId = DEMO_USERS.students[attempt.studentIndex].id;
    const attemptIndex = (counts.get(studentId) ?? 0) + 1;
    counts.set(studentId, attemptIndex);
    return DEMO_IDS.examSession(studentId, attemptIndex);
  });
}

async function seedAdminDashboardProjections() {
  for (const user of allDemoUsers()) {
    const createdAt = userDate(user.id);
    await prisma.dashboardUserProjection.upsert({
      where: { userId: user.id },
      update: {
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: true,
        licenseTier: 'licenseTier' in user ? user.licenseTier : null,
        updatedAt: new Date('2026-06-13T09:00:00.000Z'),
      },
      create: {
        userId: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: true,
        licenseTier: 'licenseTier' in user ? user.licenseTier : null,
        createdAt,
        updatedAt: new Date('2026-06-13T09:00:00.000Z'),
      },
    });
  }

  for (const course of DEMO_COURSES) {
    const createdAt = courseDate(course.slug);
    await prisma.dashboardCourseProjection.upsert({
      where: { courseId: DEMO_IDS.course(course.slug) },
      update: {
        title: course.title,
        licenseCategory: course.licenseCategory,
        status: course.status,
        isDeleted: course.status === 'ARCHIVED',
        updatedAt: new Date('2026-06-13T09:00:00.000Z'),
      },
      create: {
        courseId: DEMO_IDS.course(course.slug),
        title: course.title,
        licenseCategory: course.licenseCategory,
        status: course.status,
        isDeleted: course.status === 'ARCHIVED',
        createdAt,
        updatedAt: new Date('2026-06-13T09:00:00.000Z'),
      },
    });
  }

  const attemptCounts = new Map<string, number>();
  for (const attempt of DEMO_EXAM_ATTEMPTS) {
    const student = DEMO_USERS.students[attempt.studentIndex];
    const attemptIndex = (attemptCounts.get(student.id) ?? 0) + 1;
    attemptCounts.set(student.id, attemptIndex);
    await prisma.dashboardExamSessionProjection.upsert({
      where: { sessionId: DEMO_IDS.examSession(student.id, attemptIndex) },
      update: {
        studentId: student.id,
        licenseCategory: attempt.licenseCategory,
        score: attempt.score,
        isPassed: attempt.isPassed,
        completedAt: new Date(attempt.completedAt),
      },
      create: {
        sessionId: DEMO_IDS.examSession(student.id, attemptIndex),
        studentId: student.id,
        licenseCategory: attempt.licenseCategory,
        score: attempt.score,
        isPassed: attempt.isPassed,
        completedAt: new Date(attempt.completedAt),
      },
    });
  }

  for (const activity of DEMO_DASHBOARD_ACTIVITIES) {
    await prisma.dashboardRecentActivityProjection.upsert({
      where: { eventId: DEMO_IDS.dashboardActivity(activity.slug) },
      update: {
        type: activity.type,
        title: activity.title,
        description: activity.description,
        actorId: DEMO_USERS.admin.id,
        actorName: DEMO_USERS.admin.fullName,
        resourceType: activity.resourceType,
        resourceId: activity.resourceId,
        licenseCategory: null,
        occurredAt: new Date(activity.occurredAt),
      },
      create: {
        eventId: DEMO_IDS.dashboardActivity(activity.slug),
        type: activity.type,
        title: activity.title,
        description: activity.description,
        actorId: DEMO_USERS.admin.id,
        actorName: DEMO_USERS.admin.fullName,
        resourceType: activity.resourceType,
        resourceId: activity.resourceId,
        licenseCategory: null,
        occurredAt: new Date(activity.occurredAt),
      },
    });
  }
}

async function seedInstructorDashboardProjections() {
  for (const course of DEMO_COURSES) {
    const createdAt = courseDate(course.slug);
    await prisma.instructorCourseProjection.upsert({
      where: { courseId: DEMO_IDS.course(course.slug) },
      update: {
        title: course.title,
        licenseCategory: course.licenseCategory,
        status: course.status,
        isDeleted: course.status === 'ARCHIVED',
        capacity: 30,
        totalLessons: 5,
        updatedAt: new Date('2026-06-13T09:00:00.000Z'),
      },
      create: {
        courseId: DEMO_IDS.course(course.slug),
        title: course.title,
        licenseCategory: course.licenseCategory,
        status: course.status,
        isDeleted: course.status === 'ARCHIVED',
        capacity: 30,
        totalLessons: 5,
        createdAt,
        updatedAt: new Date('2026-06-13T09:00:00.000Z'),
      },
    });

    for (const instructorId of demoInstructorIdsForCourse(course.slug)) {
      await prisma.instructorCourseAssignmentProjection.upsert({
        where: {
          courseId_instructorId: {
            courseId: DEMO_IDS.course(course.slug),
            instructorId,
          },
        },
        update: {},
        create: {
          courseId: DEMO_IDS.course(course.slug),
          instructorId,
        },
      });
    }
  }

  for (const enrollment of DEMO_COURSE_ENROLLMENTS) {
    const student = DEMO_USERS.students[enrollment.studentIndex];
    await prisma.instructorEnrollmentProjection.upsert({
      where: {
        enrollmentId: DEMO_IDS.enrollment(enrollment.courseSlug, student.id),
      },
      update: {
        courseId: DEMO_IDS.course(enrollment.courseSlug),
        studentId: student.id,
        status: enrollment.status,
        progress: enrollment.progress,
        enrolledAt: new Date('2026-05-01T09:00:00.000Z'),
        completedAt:
          enrollment.status === 'COMPLETED'
            ? new Date('2026-05-18T09:00:00.000Z')
            : null,
        updatedAt: new Date('2026-06-13T09:00:00.000Z'),
      },
      create: {
        enrollmentId: DEMO_IDS.enrollment(enrollment.courseSlug, student.id),
        courseId: DEMO_IDS.course(enrollment.courseSlug),
        studentId: student.id,
        status: enrollment.status,
        progress: enrollment.progress,
        enrolledAt: new Date('2026-05-01T09:00:00.000Z'),
        completedAt:
          enrollment.status === 'COMPLETED'
            ? new Date('2026-05-18T09:00:00.000Z')
            : null,
      },
    });
  }

  for (const [index, schedule] of DEMO_COURSE_SCHEDULES.entries()) {
    const instructorId = demoInstructorIdsForCourse(schedule.courseSlug)[0];
    await prisma.instructorScheduleProjection.upsert({
      where: { scheduleId: DEMO_IDS.schedule(schedule.courseSlug, index + 1) },
      update: {
        courseId: DEMO_IDS.course(schedule.courseSlug),
        instructorId,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: schedule.room,
        effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
        effectiveTo: null,
        isActive: true,
        updatedAt: new Date('2026-06-13T09:00:00.000Z'),
      },
      create: {
        scheduleId: DEMO_IDS.schedule(schedule.courseSlug, index + 1),
        courseId: DEMO_IDS.course(schedule.courseSlug),
        instructorId,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: schedule.room,
        effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
        effectiveTo: null,
        isActive: true,
      },
    });
  }

  const sessionIds = examSessionIds();
  await prisma.instructorTopicAttemptProjection.deleteMany({
    where: { sessionId: { in: sessionIds } },
  });

  const topicAttempts: Array<{
    id: string;
    sessionId: string;
    studentId: string;
    topicId: string;
    topicName: string;
    isCorrect: boolean;
    occurredAt: Date;
  }> = [];
  const attemptCounts = new Map<string, number>();
  for (const attempt of DEMO_EXAM_ATTEMPTS) {
    const student = DEMO_USERS.students[attempt.studentIndex];
    const attemptIndex = (attemptCounts.get(student.id) ?? 0) + 1;
    attemptCounts.set(student.id, attemptIndex);
    const sessionId = DEMO_IDS.examSession(student.id, attemptIndex);
    const completedAt = new Date(attempt.completedAt);

    await prisma.instructorExamSessionProjection.upsert({
      where: { sessionId },
      update: {
        studentId: student.id,
        score: attempt.score,
        isPassed: attempt.isPassed,
        completedAt,
      },
      create: {
        sessionId,
        studentId: student.id,
        score: attempt.score,
        isPassed: attempt.isPassed,
        completedAt,
      },
    });

    for (const topicResult of attempt.topicResults) {
      for (let index = 0; index < topicResult.answered; index += 1) {
        topicAttempts.push({
          id: DEMO_IDS.topicAttempt(
            sessionId,
            topicResult.topicIndex,
            topicAttempts.length + 1,
          ),
          sessionId,
          studentId: student.id,
          topicId: DEMO_TOPIC_IDS[topicResult.topicIndex],
          topicName: DEMO_TOPIC_NAMES[topicResult.topicIndex],
          isCorrect: index < topicResult.correct,
          occurredAt: completedAt,
        });
      }
    }
  }

  if (topicAttempts.length > 0) {
    await prisma.instructorTopicAttemptProjection.createMany({
      data: topicAttempts,
      skipDuplicates: true,
    });
  }
}

async function main() {
  for (const student of DEMO_USERS.students) {
    const preset = student.progressSeed as keyof typeof profilePresets;
    const profile = profilePresets[preset];

    await prisma.studentLearningProfile.upsert({
      where: { studentId: student.id },
      update: {
        totalStudyMinutes: profile.study,
        totalExamAttempts: profile.attempts,
        passedExams: profile.passed,
        avgExamScore: profile.avg,
        coursesEnrolled: profile.enrolled,
        coursesCompleted: profile.completed,
        lastActivityAt: new Date('2026-05-21T08:30:00.000Z'),
      },
      create: {
        id: student.id,
        studentId: student.id,
        totalStudyMinutes: profile.study,
        totalExamAttempts: profile.attempts,
        passedExams: profile.passed,
        avgExamScore: profile.avg,
        coursesEnrolled: profile.enrolled,
        coursesCompleted: profile.completed,
        lastActivityAt: new Date('2026-05-21T08:30:00.000Z'),
      },
    });

    await seedDailyActivity(student.id, preset);
    await seedWeakTopics(student.id, preset);
  }

  await seedAdminDashboardProjections();
  await seedInstructorDashboardProjections();

  console.log(
    `Seeded analytics_db: ${DEMO_USERS.students.length} learning profiles, ${DEMO_EXAM_ATTEMPTS.length} dashboard exam attempts`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
