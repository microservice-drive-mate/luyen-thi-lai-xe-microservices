import { LicenseCategory } from '../../../domain/aggregates/course/course.types';
import { EnrollmentStatus } from '../../../domain/aggregates/course-enrollment/course-enrollment.types';
import { CourseEnrollmentRepository } from '../../../domain/repositories/course-enrollment.repository';
import { ListAdminStudentEnrollmentsQuery } from './list-admin-student-enrollments.query';
import { ListAdminStudentEnrollmentsUseCase } from './list-admin-student-enrollments.use-case';

describe('ListAdminStudentEnrollmentsUseCase', () => {
  function createUseCase() {
    const repository = {
      findByStudentIdWithCourse: jest.fn(),
    } as unknown as jest.Mocked<CourseEnrollmentRepository>;
    return {
      repository,
      useCase: new ListAdminStudentEnrollmentsUseCase(repository),
    };
  }

  it('lists all enrollments with course snapshot when no status filter is provided', async () => {
    const { repository, useCase } = createUseCase();
    repository.findByStudentIdWithCourse.mockResolvedValue({
      total: 2,
      items: [
        {
          id: 'enrollment-1',
          courseId: 'course-1',
          studentId: 'student-1',
          status: EnrollmentStatus.ACTIVE,
          progress: 40,
          enrolledAt: new Date('2026-06-01T00:00:00.000Z'),
          completedAt: null,
          course: {
            id: 'course-1',
            courseCode: 'A1-001',
            title: 'A1 Basics',
            licenseCategory: LicenseCategory.A1,
          },
        },
        {
          id: 'enrollment-2',
          courseId: 'course-2',
          studentId: 'student-1',
          status: EnrollmentStatus.COMPLETED,
          progress: 100,
          enrolledAt: new Date('2026-05-01T00:00:00.000Z'),
          completedAt: new Date('2026-05-20T00:00:00.000Z'),
          course: {
            id: 'course-2',
            courseCode: null,
            title: 'B2 Practice',
            licenseCategory: LicenseCategory.B2,
          },
        },
      ],
    });

    const result = await useCase.execute(
      new ListAdminStudentEnrollmentsQuery('student-1', 1, 100),
    );

    expect(repository.findByStudentIdWithCourse).toHaveBeenCalledWith({
      studentId: 'student-1',
      status: undefined,
      page: 1,
      size: 100,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        enrollmentId: 'enrollment-1',
        courseId: 'course-1',
        courseCode: 'A1-001',
        title: 'A1 Basics',
        licenseCategory: 'A1',
        status: EnrollmentStatus.ACTIVE,
      }),
      expect.objectContaining({
        enrollmentId: 'enrollment-2',
        courseId: 'course-2',
        courseCode: null,
        title: 'B2 Practice',
        licenseCategory: 'B2',
        status: EnrollmentStatus.COMPLETED,
      }),
    ]);
    expect(result.total).toBe(2);
  });

  it('passes status filter through to the repository', async () => {
    const { repository, useCase } = createUseCase();
    repository.findByStudentIdWithCourse.mockResolvedValue({
      total: 0,
      items: [],
    });

    await useCase.execute(
      new ListAdminStudentEnrollmentsQuery(
        'student-1',
        1,
        20,
        EnrollmentStatus.DROPPED,
      ),
    );

    expect(repository.findByStudentIdWithCourse).toHaveBeenCalledWith({
      studentId: 'student-1',
      status: EnrollmentStatus.DROPPED,
      page: 1,
      size: 20,
    });
  });
});
