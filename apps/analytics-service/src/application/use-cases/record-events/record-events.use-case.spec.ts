import {
  RecordLearningEventUseCase,
  LearningEventCommand,
} from './record-events.use-case';

describe('RecordLearningEventUseCase', () => {
  let useCase: RecordLearningEventUseCase;
  let repository: any;
  let cache: any;

  beforeEach(() => {
    repository = {
      ensureStudent: jest.fn(),
      recordExamCompleted: jest.fn(),
      recordEnrollmentCreated: jest.fn(),
      recordEnrollmentCompleted: jest.fn(),
      recordLessonCompleted: jest.fn(),
      resetProgress: jest.fn(),
    };
    cache = {
      invalidate: jest.fn(),
    };

    useCase = new RecordLearningEventUseCase(repository, cache);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should handle student-created event and invalidate cache', async () => {
    const command: LearningEventCommand = {
      type: 'student-created',
      studentId: 'stu-1',
    };
    await useCase.execute(command);
    expect(repository.ensureStudent).toHaveBeenCalledWith('stu-1');
    expect(cache.invalidate).toHaveBeenCalledWith('stu-1');
  });

  it('should handle exam-completed event and invalidate cache', async () => {
    const payload = {
      studentId: 'stu-1',
      isPassed: true,
      licenseCategory: 'B2',
      score: 100,
    };
    const command: LearningEventCommand = { type: 'exam-completed', payload };
    await useCase.execute(command);
    expect(repository.recordExamCompleted).toHaveBeenCalledWith(payload);
    expect(cache.invalidate).toHaveBeenCalledWith('stu-1');
  });

  it('should handle lesson-completed event and invalidate cache', async () => {
    const command: LearningEventCommand = {
      type: 'lesson-completed',
      studentId: 'stu-1',
      minutes: 45,
    };
    await useCase.execute(command);
    expect(repository.recordLessonCompleted).toHaveBeenCalledWith('stu-1', 45);
    expect(cache.invalidate).toHaveBeenCalledWith('stu-1');
  });
});
