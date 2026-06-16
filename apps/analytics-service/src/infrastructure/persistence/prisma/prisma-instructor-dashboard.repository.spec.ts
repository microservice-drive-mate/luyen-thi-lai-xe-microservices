import { PrismaInstructorDashboardRepository } from './prisma-instructor-dashboard.repository';

describe('PrismaInstructorDashboardRepository', () => {
  function createRepository() {
    const prisma = {
      instructorCourseAssignmentProjection: {
        findMany: jest.fn().mockResolvedValue([
          { courseId: 'course-1', instructorId: 'instructor-1' },
          { courseId: 'course-2', instructorId: 'instructor-1' },
        ]),
      },
      instructorCourseProjection: {
        findMany: jest.fn().mockResolvedValue([
          {
            courseId: 'course-1',
            title: 'A1 Basics',
            licenseCategory: 'A1',
          },
          {
            courseId: 'course-2',
            title: 'B2 Practice',
            licenseCategory: 'B2',
          },
        ]),
      },
      instructorEnrollmentProjection: {
        findMany: jest.fn().mockResolvedValue([
          {
            courseId: 'course-1',
            studentId: 'student-2',
            status: 'COMPLETED',
            progress: 100,
            enrolledAt: new Date('2026-06-02T00:00:00.000Z'),
            completedAt: new Date('2026-06-10T00:00:00.000Z'),
          },
          {
            courseId: 'course-1',
            studentId: 'student-1',
            status: 'ACTIVE',
            progress: 35,
            enrolledAt: new Date('2026-06-01T00:00:00.000Z'),
            completedAt: null,
          },
          {
            courseId: 'course-2',
            studentId: 'student-3',
            status: 'ACTIVE',
            progress: 10,
            enrolledAt: new Date('2026-06-03T00:00:00.000Z'),
            completedAt: null,
          },
        ]),
      },
      dashboardUserProjection: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'student-1',
            fullName: 'An Student',
            email: 'an@example.com',
            licenseTier: 'A1',
          },
          {
            userId: 'student-2',
            fullName: 'Binh Student',
            email: 'binh@example.com',
            licenseTier: 'A1',
          },
        ]),
      },
      instructorScheduleProjection: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      instructorExamSessionProjection: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      instructorTopicAttemptProjection: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    return {
      prisma,
      repository: new PrismaInstructorDashboardRepository(prisma as never),
    };
  }

  it('groups course students and joins dashboard user projection fields', async () => {
    const { repository } = createRepository();

    const dashboard = await repository.getDashboard('instructor-1', {
      month: '2026-06',
      monthFrom: new Date('2026-06-01T00:00:00.000Z'),
      monthTo: new Date('2026-07-01T00:00:00.000Z'),
      weekStart: new Date('2026-06-08T00:00:00.000Z'),
      weekEnd: new Date('2026-06-15T00:00:00.000Z'),
      date: new Date('2026-06-13T00:00:00.000Z'),
      timezone: 'Asia/Ho_Chi_Minh',
    });

    expect(dashboard.classProgress[0]).toMatchObject({
      courseId: 'course-1',
      totalStudents: 2,
      completedStudents: 1,
      progressPct: 50,
      students: [
        {
          studentId: 'student-1',
          fullName: 'An Student',
          email: 'an@example.com',
          licenseTier: 'A1',
          status: 'ACTIVE',
          progress: 35,
        },
        {
          studentId: 'student-2',
          fullName: 'Binh Student',
          email: 'binh@example.com',
          licenseTier: 'A1',
          status: 'COMPLETED',
          progress: 100,
        },
      ],
    });
    expect(dashboard.classProgress[1].students).toEqual([
      expect.objectContaining({
        studentId: 'student-3',
        fullName: null,
        email: null,
        licenseTier: null,
      }),
    ]);
  });
});
