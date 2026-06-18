import { EnrollmentStatus } from '../../../domain/aggregates/course-enrollment/course-enrollment.types';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { EnrollmentNotFoundException } from '../../../domain/exceptions/enrollment-not-found.exception';
import { CompleteLessonCommand } from './complete-lesson.command';
import { CompleteLessonUseCase } from './complete-lesson.use-case';

describe('CompleteLessonUseCase', () => {
  let useCase: CompleteLessonUseCase;
  let enrollmentRepository: any;
  let courseRepository: any;
  let eventPublisher: any;
  let metricsService: any;

  beforeEach(() => {
    enrollmentRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };
    courseRepository = {
      findById: jest.fn(),
    };
    eventPublisher = {
      publishAll: jest.fn(),
    };
    metricsService = {
      recordCourseLessonCompleted: jest.fn(),
      recordCourseEnrollmentCompleted: jest.fn(),
    };

    useCase = new CompleteLessonUseCase(
      enrollmentRepository,
      courseRepository,
      eventPublisher,
      metricsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw EnrollmentNotFoundException if enrollment does not exist', async () => {
    enrollmentRepository.findById.mockResolvedValue(null);
    const cmd = new CompleteLessonCommand('enrollment-1', 'lesson-1');
    await expect(useCase.execute(cmd)).rejects.toThrow(
      EnrollmentNotFoundException,
    );
  });

  it('should throw CourseNotFoundException if course does not exist', async () => {
    enrollmentRepository.findById.mockResolvedValue({ courseId: 'course-1' });
    courseRepository.findById.mockResolvedValue(null);
    const cmd = new CompleteLessonCommand('enrollment-1', 'lesson-1');
    await expect(useCase.execute(cmd)).rejects.toThrow(CourseNotFoundException);
  });

  it('should complete lesson, publish events, and record metrics', async () => {
    const mockEnrollment = {
      courseId: 'course-1',
      status: EnrollmentStatus.ACTIVE,
      completeLesson: jest.fn(),
      getDomainEvents: jest.fn().mockReturnValue([]),
      clearDomainEvents: jest.fn(),
      toSnapshot: jest.fn().mockReturnValue({
        id: 'enrollment-1',
        status: EnrollmentStatus.ACTIVE,
      }),
    };

    enrollmentRepository.findById.mockResolvedValue(mockEnrollment);
    courseRepository.findById.mockResolvedValue({ totalLessons: 10 });

    const cmd = new CompleteLessonCommand('enrollment-1', 'lesson-1');
    await useCase.execute(cmd);

    expect(mockEnrollment.completeLesson).toHaveBeenCalledWith('lesson-1', 10);
    expect(enrollmentRepository.save).toHaveBeenCalledWith(mockEnrollment);
    expect(eventPublisher.publishAll).toHaveBeenCalled();
    expect(metricsService.recordCourseLessonCompleted).toHaveBeenCalledWith({
      courseId: 'course-1',
      enrollmentStatus: EnrollmentStatus.ACTIVE,
    });
  });
});
