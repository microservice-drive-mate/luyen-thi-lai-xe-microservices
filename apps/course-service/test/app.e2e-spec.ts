import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiResponseInterceptor } from '@repo/common';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { ActivateCourseUseCase } from '../src/application/use-cases/activate-course/activate-course.use-case';
import { AddCourseMaterialUseCase } from '../src/application/use-cases/add-course-material/add-course-material.use-case';
import { AddLessonUseCase } from '../src/application/use-cases/add-lesson/add-lesson.use-case';
import { AssignCourseInstructorUseCase } from '../src/application/use-cases/assign-course-instructor/assign-course-instructor.use-case';
import { CompleteLessonUseCase } from '../src/application/use-cases/complete-lesson/complete-lesson.use-case';
import { CreateCourseUseCase } from '../src/application/use-cases/create-course/create-course.use-case';
import { CreateCourseScheduleUseCase } from '../src/application/use-cases/create-course-schedule/create-course-schedule.use-case';
import { DeleteCourseUseCase } from '../src/application/use-cases/delete-course/delete-course.use-case';
import { DeleteCourseScheduleUseCase } from '../src/application/use-cases/delete-course-schedule/delete-course-schedule.use-case';
import { EnrollStudentUseCase } from '../src/application/use-cases/enroll-student/enroll-student.use-case';
import { GetCourseUseCase } from '../src/application/use-cases/get-course/get-course.use-case';
import { GetEnrollmentUseCase } from '../src/application/use-cases/get-enrollment/get-enrollment.use-case';
import { GetLessonUseCase } from '../src/application/use-cases/get-lesson/get-lesson.use-case';
import { ListAdminStudentEnrollmentsUseCase } from '../src/application/use-cases/list-admin-student-enrollments/list-admin-student-enrollments.use-case';
import { ListCourseSchedulesUseCase } from '../src/application/use-cases/list-course-schedules/list-course-schedules.use-case';
import { ListCoursesUseCase } from '../src/application/use-cases/list-courses/list-courses.use-case';
import { ListStudentEnrollmentsUseCase } from '../src/application/use-cases/list-student-enrollments/list-student-enrollments.use-case';
import { RemoveCourseInstructorUseCase } from '../src/application/use-cases/remove-course-instructor/remove-course-instructor.use-case';
import { RemoveLessonUseCase } from '../src/application/use-cases/remove-lesson/remove-lesson.use-case';
import { ResetEnrollmentProgressUseCase } from '../src/application/use-cases/reset-enrollment-progress/reset-enrollment-progress.use-case';
import { UnenrollStudentUseCase } from '../src/application/use-cases/unenroll-student/unenroll-student.use-case';
import { UpdateCourseUseCase } from '../src/application/use-cases/update-course/update-course.use-case';
import { UpdateCourseScheduleUseCase } from '../src/application/use-cases/update-course-schedule/update-course-schedule.use-case';
import { UpdateLessonUseCase } from '../src/application/use-cases/update-lesson/update-lesson.use-case';
import { AdminCourseController } from '../src/presentation/http/admin-course.controller';
import { AdminEnrollmentController } from '../src/presentation/http/admin-enrollment.controller';
import { CourseController } from '../src/presentation/http/course.controller';
import { EnrollmentController } from '../src/presentation/http/enrollment.controller';

describe('Course service HTTP contract (e2e smoke)', () => {
  let app: INestApplication;

  const createCourseUseCase = { execute: jest.fn() };
  const updateCourseUseCase = { execute: jest.fn() };
  const activateCourseUseCase = { execute: jest.fn() };
  const addLessonUseCase = { execute: jest.fn() };
  const removeLessonUseCase = { execute: jest.fn() };
  const addCourseMaterialUseCase = { execute: jest.fn() };
  const getCourseUseCase = { execute: jest.fn() };
  const listCoursesUseCase = { execute: jest.fn() };
  const deleteCourseUseCase = { execute: jest.fn() };
  const createCourseScheduleUseCase = { execute: jest.fn() };
  const updateCourseScheduleUseCase = { execute: jest.fn() };
  const deleteCourseScheduleUseCase = { execute: jest.fn() };
  const listCourseSchedulesUseCase = { execute: jest.fn() };
  const updateLessonUseCase = { execute: jest.fn() };
  const assignCourseInstructorUseCase = { execute: jest.fn() };
  const removeCourseInstructorUseCase = { execute: jest.fn() };
  const enrollStudentUseCase = { execute: jest.fn() };
  const unenrollStudentUseCase = { execute: jest.fn() };
  const getLessonUseCase = { execute: jest.fn() };
  const getEnrollmentUseCase = { execute: jest.fn() };
  const listStudentEnrollmentsUseCase = { execute: jest.fn() };
  const completeLessonUseCase = { execute: jest.fn() };
  const resetEnrollmentProgressUseCase = { execute: jest.fn() };
  const listAdminStudentEnrollmentsUseCase = { execute: jest.fn() };

  const now = new Date('2026-06-01T00:00:00.000Z');

  const courseResult = (overrides = {}) => ({
    id: 'course-1',
    courseCode: 'B1-FOUNDATION',
    title: 'Khoa hoc B1 co ban',
    description: 'Khoa hoc nen tang',
    licenseCategory: 'B1',
    totalLessons: 2,
    duration: '3 thang',
    tuitionFee: 5000000,
    capacity: 30,
    status: 'ACTIVE',
    version: 1,
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    createdById: 'manager-1',
    createdAt: now,
    updatedAt: now,
    lessons: [],
    instructorIds: [],
    requirement: null,
    materials: [],
    ...overrides,
  });

  const enrollmentResult = (overrides = {}) => ({
    id: 'enrollment-1',
    courseId: 'course-1',
    studentId: 'student-1',
    status: 'ACTIVE',
    progress: 0,
    enrolledAt: now,
    completedAt: null,
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        CourseController,
        EnrollmentController,
        AdminCourseController,
        AdminEnrollmentController,
      ],
      providers: [
        { provide: CreateCourseUseCase, useValue: createCourseUseCase },
        { provide: UpdateCourseUseCase, useValue: updateCourseUseCase },
        { provide: ActivateCourseUseCase, useValue: activateCourseUseCase },
        { provide: AddLessonUseCase, useValue: addLessonUseCase },
        { provide: RemoveLessonUseCase, useValue: removeLessonUseCase },
        {
          provide: AddCourseMaterialUseCase,
          useValue: addCourseMaterialUseCase,
        },
        { provide: GetCourseUseCase, useValue: getCourseUseCase },
        { provide: ListCoursesUseCase, useValue: listCoursesUseCase },
        { provide: DeleteCourseUseCase, useValue: deleteCourseUseCase },
        {
          provide: CreateCourseScheduleUseCase,
          useValue: createCourseScheduleUseCase,
        },
        {
          provide: UpdateCourseScheduleUseCase,
          useValue: updateCourseScheduleUseCase,
        },
        {
          provide: DeleteCourseScheduleUseCase,
          useValue: deleteCourseScheduleUseCase,
        },
        {
          provide: ListCourseSchedulesUseCase,
          useValue: listCourseSchedulesUseCase,
        },
        { provide: UpdateLessonUseCase, useValue: updateLessonUseCase },
        {
          provide: AssignCourseInstructorUseCase,
          useValue: assignCourseInstructorUseCase,
        },
        {
          provide: RemoveCourseInstructorUseCase,
          useValue: removeCourseInstructorUseCase,
        },
        { provide: EnrollStudentUseCase, useValue: enrollStudentUseCase },
        { provide: UnenrollStudentUseCase, useValue: unenrollStudentUseCase },
        { provide: GetLessonUseCase, useValue: getLessonUseCase },
        { provide: GetEnrollmentUseCase, useValue: getEnrollmentUseCase },
        {
          provide: ListStudentEnrollmentsUseCase,
          useValue: listStudentEnrollmentsUseCase,
        },
        { provide: CompleteLessonUseCase, useValue: completeLessonUseCase },
        {
          provide: ResetEnrollmentProgressUseCase,
          useValue: resetEnrollmentProgressUseCase,
        },
        {
          provide: ListAdminStudentEnrollmentsUseCase,
          useValue: listAdminStudentEnrollmentsUseCase,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(
      (
        req: Request & { user?: unknown },
        _res: Response,
        next: NextFunction,
      ) => {
        req.user = { sub: req.header('x-user-id') ?? 'student-1' };
        next();
      },
    );
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /courses returns active courses in the shared envelope', async () => {
    listCoursesUseCase.execute.mockResolvedValue({
      items: [courseResult()],
      total: 1,
      page: 1,
      size: 20,
    });

    await request(app.getHttpServer())
      .get('/courses')
      .expect(200)
      .expect((response) => {
        expect(response.body.data.total).toBe(1);
        expect(response.body.data.items[0]).toMatchObject({
          id: 'course-1',
          licenseCategory: 'B1',
          status: 'ACTIVE',
        });
      });
  });

  it('POST /admin/courses creates a course draft from admin payload', async () => {
    createCourseUseCase.execute.mockResolvedValue(
      courseResult({ status: 'DRAFT', totalLessons: 0 }),
    );

    await request(app.getHttpServer())
      .post('/admin/courses')
      .set('x-user-id', 'manager-1')
      .send({
        courseCode: 'B1-FOUNDATION',
        title: 'Khoa hoc B1 co ban',
        licenseCategory: 'B1',
        description: 'Khoa hoc nen tang',
        duration: '3 thang',
        tuitionFee: 5000000,
        capacity: 30,
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          id: 'course-1',
          status: 'DRAFT',
        });
      });
    expect(createCourseUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it('POST /courses/:id/enroll enrolls the current student', async () => {
    enrollStudentUseCase.execute.mockResolvedValue(enrollmentResult());

    await request(app.getHttpServer())
      .post('/courses/course-1/enroll')
      .set('x-user-id', 'student-1')
      .expect(201)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          courseId: 'course-1',
          studentId: 'student-1',
          progress: 0,
        });
      });
  });

  it('POST /enrollments/:id/lessons/:lessonId/complete updates progress', async () => {
    completeLessonUseCase.execute.mockResolvedValue(
      enrollmentResult({ progress: 50 }),
    );

    await request(app.getHttpServer())
      .post('/enrollments/enrollment-1/lessons/lesson-1/complete')
      .set('x-user-id', 'student-1')
      .expect(200)
      .expect((response) => {
        expect(response.body.data.progress).toBe(50);
      });
  });
});
