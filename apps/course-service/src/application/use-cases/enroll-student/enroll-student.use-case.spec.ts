import { EnrollStudentUseCase } from './enroll-student.use-case';
import { EnrollStudentCommand } from './enroll-student.command';
import { CourseStatus } from '../../../domain/aggregates/course/course.types';
import { EnrollmentStatus } from '../../../domain/aggregates/course-enrollment/course-enrollment.types';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { CourseNotActiveException } from '../../../domain/exceptions/course-not-active.exception';
import { EnrollmentAlreadyExistsException } from '../../../domain/exceptions/enrollment-already-exists.exception';
import { StudentLicenseNotAssignedException } from '../../../domain/exceptions/student-license-not-assigned.exception';
import { StudentLicenseMismatchException } from '../../../domain/exceptions/student-license-mismatch.exception';
import { CourseCapacityExceededException } from '../../../domain/exceptions/course-capacity-exceeded.exception';

describe('EnrollStudentUseCase', () => {
  let useCase: EnrollStudentUseCase;
  let courseRepository: any;
  let enrollmentRepository: any;
  let studentLicenseProfileRepository: any;
  let eventPublisher: any;
  let courseCache: any;

  beforeEach(() => {
    courseRepository = {
      findById: jest.fn(),
      countEnrollments: jest.fn(),
    };
    enrollmentRepository = {
      findByStudentAndCourse: jest.fn(),
      save: jest.fn(),
    };
    studentLicenseProfileRepository = {
      findByStudentId: jest.fn(),
    };
    eventPublisher = {
      publish: jest.fn(),
    };
    courseCache = {
      invalidateCourse: jest.fn(),
    };

    useCase = new EnrollStudentUseCase(
      courseRepository,
      enrollmentRepository,
      studentLicenseProfileRepository,
      eventPublisher,
      courseCache,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw CourseNotFoundException if course does not exist', async () => {
    courseRepository.findById.mockResolvedValue(null);
    const cmd = new EnrollStudentCommand('course-1', 'student-1');
    await expect(useCase.execute(cmd)).rejects.toThrow(CourseNotFoundException);
  });

  it('should throw CourseNotActiveException if course is not active', async () => {
    courseRepository.findById.mockResolvedValue({ status: CourseStatus.DRAFT });
    const cmd = new EnrollStudentCommand('course-1', 'student-1');
    await expect(useCase.execute(cmd)).rejects.toThrow(
      CourseNotActiveException,
    );
  });

  it('should throw EnrollmentAlreadyExistsException if enrollment exists and is active', async () => {
    courseRepository.findById.mockResolvedValue({
      status: CourseStatus.ACTIVE,
    });
    enrollmentRepository.findByStudentAndCourse.mockResolvedValue({
      status: EnrollmentStatus.ACTIVE,
    });

    const cmd = new EnrollStudentCommand('course-1', 'student-1');
    await expect(useCase.execute(cmd)).rejects.toThrow(
      EnrollmentAlreadyExistsException,
    );
  });

  it('should throw StudentLicenseNotAssignedException if student has no license profile', async () => {
    courseRepository.findById.mockResolvedValue({
      status: CourseStatus.ACTIVE,
      licenseCategory: 'B2',
    });
    enrollmentRepository.findByStudentAndCourse.mockResolvedValue(null);
    studentLicenseProfileRepository.findByStudentId.mockResolvedValue(null);

    const cmd = new EnrollStudentCommand('course-1', 'student-1');
    await expect(useCase.execute(cmd)).rejects.toThrow(
      StudentLicenseNotAssignedException,
    );
  });

  it('should throw StudentLicenseMismatchException if licenses do not match', async () => {
    courseRepository.findById.mockResolvedValue({
      status: CourseStatus.ACTIVE,
      licenseCategory: 'B2',
    });
    enrollmentRepository.findByStudentAndCourse.mockResolvedValue(null);
    studentLicenseProfileRepository.findByStudentId.mockResolvedValue({
      licenseTier: 'C',
    });

    const cmd = new EnrollStudentCommand('course-1', 'student-1');
    await expect(useCase.execute(cmd)).rejects.toThrow(
      StudentLicenseMismatchException,
    );
  });

  it('should throw CourseCapacityExceededException if capacity is full', async () => {
    courseRepository.findById.mockResolvedValue({
      status: CourseStatus.ACTIVE,
      licenseCategory: 'B2',
      capacity: 10,
    });
    enrollmentRepository.findByStudentAndCourse.mockResolvedValue(null);
    studentLicenseProfileRepository.findByStudentId.mockResolvedValue({
      licenseTier: 'B2',
    });
    courseRepository.countEnrollments.mockResolvedValue(10);

    const cmd = new EnrollStudentCommand('course-1', 'student-1');
    await expect(useCase.execute(cmd)).rejects.toThrow(
      CourseCapacityExceededException,
    );
  });

  it('should successfully enroll student', async () => {
    courseRepository.findById.mockResolvedValue({
      status: CourseStatus.ACTIVE,
      licenseCategory: 'B2',
      capacity: 10,
    });
    enrollmentRepository.findByStudentAndCourse.mockResolvedValue(null);
    studentLicenseProfileRepository.findByStudentId.mockResolvedValue({
      licenseTier: 'B2',
    });
    courseRepository.countEnrollments.mockResolvedValue(5);

    const cmd = new EnrollStudentCommand('course-1', 'student-1');
    const result = await useCase.execute(cmd);

    expect(result.status).toBe(EnrollmentStatus.ACTIVE);
    expect(enrollmentRepository.save).toHaveBeenCalled();
    expect(courseCache.invalidateCourse).toHaveBeenCalledWith('course-1');
    expect(eventPublisher.publish).toHaveBeenCalled();
  });
});
