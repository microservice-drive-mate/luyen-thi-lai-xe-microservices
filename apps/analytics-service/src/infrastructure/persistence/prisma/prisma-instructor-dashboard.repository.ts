import { Injectable } from '@nestjs/common';
import {
  InstructorCourseProjectionInput,
  InstructorDashboard,
  InstructorDashboardQueryPeriod,
  InstructorEnrollmentProjectionInput,
  InstructorExamProjectionInput,
  InstructorScheduleProjectionInput,
} from '../../../domain/dashboard/instructor-dashboard.types';
import {
  addDays,
  toDateKey,
} from '../../../domain/dashboard/instructor-dashboard.period';
import { InstructorDashboardRepository } from '../../../domain/repositories/instructor-dashboard.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaInstructorDashboardRepository extends InstructorDashboardRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async getDashboard(
    instructorId: string,
    period: InstructorDashboardQueryPeriod,
  ): Promise<InstructorDashboard> {
    const assignments =
      await this.prisma.instructorCourseAssignmentProjection.findMany({
        where: { instructorId },
      });
    const assignedCourseIds = assignments.map((item) => item.courseId);
    const courses: CourseRecord[] =
      assignedCourseIds.length === 0
        ? []
        : await this.prisma.instructorCourseProjection.findMany({
            where: {
              courseId: { in: assignedCourseIds },
              status: 'ACTIVE',
              isDeleted: false,
            },
            orderBy: { title: 'asc' },
          });
    const courseIds = courses.map((course) => course.courseId);

    const enrollments: EnrollmentRecord[] =
      courseIds.length === 0
        ? []
        : await this.prisma.instructorEnrollmentProjection.findMany({
            where: { courseId: { in: courseIds }, status: { not: 'DROPPED' } },
          });
    const userProfiles: DashboardUserRecord[] =
      enrollments.length === 0
        ? []
        : await this.prisma.dashboardUserProjection.findMany({
            where: {
              userId: {
                in: [...new Set(enrollments.map((item) => item.studentId))],
              },
            },
          });
    const schedules: ScheduleRecord[] =
      courseIds.length === 0
        ? []
        : await this.prisma.instructorScheduleProjection.findMany({
            where: {
              instructorId,
              courseId: { in: courseIds },
              isActive: true,
            },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          });

    const studentIds = [...new Set(enrollments.map((item) => item.studentId))];
    const examSessions: ExamSessionRecord[] =
      studentIds.length === 0
        ? []
        : await this.prisma.instructorExamSessionProjection.findMany({
            where: {
              studentId: { in: studentIds },
              completedAt: { gte: period.monthFrom, lt: period.monthTo },
            },
          });
    const topicAttempts: TopicAttemptRecord[] =
      studentIds.length === 0
        ? []
        : await this.prisma.instructorTopicAttemptProjection.findMany({
            where: {
              studentId: { in: studentIds },
              occurredAt: { gte: period.monthFrom, lt: period.monthTo },
            },
          });

    const courseStudentCounts = countStudentsByCourse(enrollments);
    const completedByCourse = countCompletedByCourse(enrollments);
    const totalStudents = studentIds.length;
    const passedExams = examSessions.filter(
      (session) => session.isPassed,
    ).length;
    const passRate =
      examSessions.length === 0
        ? 0
        : Math.round((passedExams / examSessions.length) * 100);

    return {
      period: {
        month: period.month,
        weekStart: toDateKey(period.weekStart),
        date: toDateKey(period.date),
        timezone: period.timezone,
      },
      summary: {
        activeClassCount: courses.length,
        totalStudents,
        passRate,
        teachingHoursThisMonth: roundHours(
          schedules.reduce(
            (sum, schedule) =>
              sum +
              scheduledHoursInRange(schedule, period.monthFrom, period.monthTo),
            0,
          ),
        ),
      },
      weeklyTeachingTrend: buildWeeklyTrend(
        period.weekStart,
        schedules,
        courseStudentCounts,
      ),
      topicAverages: buildTopicAverages(topicAttempts),
      classProgress: courses.map((course) => {
        const total = courseStudentCounts.get(course.courseId) ?? 0;
        const completed = completedByCourse.get(course.courseId) ?? 0;
        return {
          courseId: course.courseId,
          title: course.title ?? course.courseId,
          licenseCategory: course.licenseCategory,
          totalStudents: total,
          completedStudents: completed,
          progressPct: total === 0 ? 0 : Math.round((completed / total) * 100),
          students: buildCourseStudents(
            course.courseId,
            enrollments,
            userProfiles,
          ),
        };
      }),
      todaySchedule: schedules
        .filter((schedule) => scheduleMatchesDate(schedule, period.date))
        .map((schedule) => {
          const course = courses.find(
            (item) => item.courseId === schedule.courseId,
          );
          return {
            scheduleId: schedule.scheduleId,
            courseId: schedule.courseId,
            title: course?.title ?? schedule.courseId,
            room: schedule.room,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            studentCount: courseStudentCounts.get(schedule.courseId) ?? 0,
          };
        }),
    };
  }

  async upsertCourseProjection(
    input: InstructorCourseProjectionInput,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.instructorCourseProjection.upsert({
        where: { courseId: input.courseId },
        create: {
          courseId: input.courseId,
          title: input.title,
          licenseCategory: input.licenseCategory,
          status: input.status,
          isDeleted: input.isDeleted,
          capacity: input.capacity,
          totalLessons: input.totalLessons ?? 0,
          createdAt: input.createdAt,
          updatedAt: input.updatedAt,
        },
        update: {
          title: input.title,
          licenseCategory: input.licenseCategory,
          status: input.status,
          isDeleted: input.isDeleted,
          capacity: input.capacity,
          totalLessons: input.totalLessons ?? 0,
          updatedAt: input.updatedAt,
        },
      });
      await tx.instructorCourseAssignmentProjection.deleteMany({
        where: { courseId: input.courseId },
      });
      if (input.instructorIds.length > 0) {
        await tx.instructorCourseAssignmentProjection.createMany({
          data: input.instructorIds.map((instructorId) => ({
            courseId: input.courseId,
            instructorId,
          })),
          skipDuplicates: true,
        });
      }
    });
  }

  async upsertEnrollmentProjection(
    input: InstructorEnrollmentProjectionInput,
  ): Promise<void> {
    await this.prisma.instructorEnrollmentProjection.upsert({
      where: { enrollmentId: input.enrollmentId },
      create: {
        enrollmentId: input.enrollmentId,
        courseId: input.courseId,
        studentId: input.studentId,
        status: input.status,
        progress: input.progress,
        enrolledAt: input.enrolledAt,
        completedAt: input.completedAt,
      },
      update: {
        courseId: input.courseId,
        studentId: input.studentId,
        status: input.status,
        progress: input.progress,
        completedAt: input.completedAt,
        updatedAt: new Date(),
      },
    });
  }

  async upsertScheduleProjection(
    input: InstructorScheduleProjectionInput,
  ): Promise<void> {
    await this.prisma.instructorScheduleProjection.upsert({
      where: { scheduleId: input.scheduleId },
      create: { ...input },
      update: { ...input, updatedAt: new Date() },
    });
  }

  async deactivateSchedule(scheduleId: string): Promise<void> {
    await this.prisma.instructorScheduleProjection.updateMany({
      where: { scheduleId },
      data: { isActive: false, updatedAt: new Date() },
    });
  }

  async recordExamCompleted(
    input: InstructorExamProjectionInput,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.instructorExamSessionProjection.upsert({
        where: { sessionId: input.sessionId },
        create: {
          sessionId: input.sessionId,
          studentId: input.studentId,
          score: input.score,
          isPassed: input.isPassed,
          completedAt: input.completedAt,
        },
        update: {
          studentId: input.studentId,
          score: input.score,
          isPassed: input.isPassed,
          completedAt: input.completedAt,
        },
      });
      await tx.instructorTopicAttemptProjection.deleteMany({
        where: { sessionId: input.sessionId },
      });
      const attempts = (input.questions ?? [])
        .filter((question) => typeof question.isCorrect === 'boolean')
        .map((question) => ({
          sessionId: input.sessionId,
          studentId: input.studentId,
          topicId: question.topicId,
          topicName: question.topicName,
          isCorrect: question.isCorrect ?? false,
          occurredAt: input.completedAt,
        }));
      if (attempts.length > 0) {
        await tx.instructorTopicAttemptProjection.createMany({
          data: attempts,
        });
      }
    });
  }
}

type CourseRecord = {
  courseId: string;
  title: string | null;
  licenseCategory: string;
};

type EnrollmentRecord = {
  courseId: string;
  studentId: string;
  status: string;
  progress: number;
  enrolledAt: Date | null;
  completedAt: Date | null;
};

type DashboardUserRecord = {
  userId: string;
  fullName: string | null;
  email: string | null;
  licenseTier: string | null;
};

type ScheduleRecord = {
  scheduleId: string;
  courseId: string;
  instructorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
};

type ExamSessionRecord = {
  sessionId: string;
  studentId: string;
  score: number | null;
  isPassed: boolean;
  completedAt: Date;
};

type TopicAttemptRecord = {
  topicId: string | null;
  topicName: string | null;
  isCorrect: boolean;
};

function countStudentsByCourse(
  enrollments: Array<{ courseId: string; studentId: string }>,
): Map<string, number> {
  const grouped = new Map<string, Set<string>>();
  for (const enrollment of enrollments) {
    const set = grouped.get(enrollment.courseId) ?? new Set<string>();
    set.add(enrollment.studentId);
    grouped.set(enrollment.courseId, set);
  }
  return new Map(
    [...grouped.entries()].map(([courseId, ids]) => [courseId, ids.size]),
  );
}

function countCompletedByCourse(
  enrollments: Array<{ courseId: string; status: string }>,
): Map<string, number> {
  const grouped = new Map<string, number>();
  for (const enrollment of enrollments) {
    if (enrollment.status !== 'COMPLETED') continue;
    grouped.set(
      enrollment.courseId,
      (grouped.get(enrollment.courseId) ?? 0) + 1,
    );
  }
  return grouped;
}

function buildCourseStudents(
  courseId: string,
  enrollments: EnrollmentRecord[],
  users: DashboardUserRecord[],
) {
  const usersById = new Map(users.map((user) => [user.userId, user]));
  return enrollments
    .filter((enrollment) => enrollment.courseId === courseId)
    .sort((a, b) => {
      const aName = usersById.get(a.studentId)?.fullName ?? a.studentId;
      const bName = usersById.get(b.studentId)?.fullName ?? b.studentId;
      return aName.localeCompare(bName);
    })
    .map((enrollment) => {
      const user = usersById.get(enrollment.studentId);
      return {
        studentId: enrollment.studentId,
        fullName: user?.fullName ?? null,
        email: user?.email ?? null,
        licenseTier: user?.licenseTier ?? null,
        status: enrollment.status,
        progress: enrollment.progress,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
      };
    });
}

function buildWeeklyTrend(
  weekStart: Date,
  schedules: ScheduleRecord[],
  courseStudentCounts: Map<string, number>,
) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const daySchedules = schedules.filter((schedule) =>
      scheduleMatchesDate(schedule, date),
    );
    return {
      date: toDateKey(date),
      label: index === 6 ? 'CN' : `T${index + 2}`,
      teachingHours: roundHours(
        daySchedules.reduce(
          (sum, schedule) => sum + scheduleHours(schedule),
          0,
        ),
      ),
      studentCount: [
        ...new Set(daySchedules.map((schedule) => schedule.courseId)),
      ].reduce(
        (sum, courseId) => sum + (courseStudentCounts.get(courseId) ?? 0),
        0,
      ),
    };
  });
}

function buildTopicAverages(
  attempts: Array<{
    topicId: string | null;
    topicName: string | null;
    isCorrect: boolean;
  }>,
) {
  const grouped = new Map<
    string,
    {
      topicId: string | null;
      topicName: string | null;
      total: number;
      correct: number;
    }
  >();
  for (const attempt of attempts) {
    const key = attempt.topicId ?? 'unknown';
    const item = grouped.get(key) ?? {
      topicId: attempt.topicId,
      topicName: attempt.topicName,
      total: 0,
      correct: 0,
    };
    item.total += 1;
    if (attempt.isCorrect) item.correct += 1;
    grouped.set(key, item);
  }
  return [...grouped.values()]
    .map((item) => ({
      topicId: item.topicId,
      topicName: item.topicName ?? item.topicId ?? 'Unknown',
      averageScore:
        item.total === 0 ? 0 : Math.round((item.correct / item.total) * 100),
      answeredQuestions: item.total,
    }))
    .sort((a, b) => b.answeredQuestions - a.answeredQuestions)
    .slice(0, 8);
}

function scheduledHoursInRange(
  schedule: ScheduleRecord,
  from: Date,
  toExclusive: Date,
): number {
  let total = 0;
  for (
    let cursor = new Date(from);
    cursor < toExclusive;
    cursor = addDays(cursor, 1)
  ) {
    if (scheduleMatchesDate(schedule, cursor)) {
      total += scheduleHours(schedule);
    }
  }
  return total;
}

function scheduleMatchesDate(schedule: ScheduleRecord, date: Date): boolean {
  if (date < toDateOnly(schedule.effectiveFrom)) return false;
  if (schedule.effectiveTo && date > toDateOnly(schedule.effectiveTo))
    return false;
  return toIsoDayOfWeek(date) === schedule.dayOfWeek;
}

function scheduleHours(schedule: {
  startTime: string;
  endTime: string;
}): number {
  return (toMinutes(schedule.endTime) - toMinutes(schedule.startTime)) / 60;
}

function roundHours(value: number): number {
  return Math.round(value * 10) / 10;
}

function toMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function toIsoDayOfWeek(value: Date): number {
  const day = value.getUTCDay();
  return day === 0 ? 7 : day;
}

function toDateOnly(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}
