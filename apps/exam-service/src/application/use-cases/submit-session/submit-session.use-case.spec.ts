import { ExamSessionStatus } from '../../../domain/aggregates/exam-session/exam-session.types';
import { ExamSessionNotFoundException } from '../../../domain/exceptions/exam.exceptions';
import { SubmitSessionCommand } from './submit-session.command';
import { SubmitSessionUseCase } from './submit-session.use-case';

describe('SubmitSessionUseCase', () => {
  let useCase: SubmitSessionUseCase;
  let sessionRepository: any;
  let eventPublisher: any;
  let metricsService: any;

  beforeEach(() => {
    sessionRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };
    eventPublisher = {
      publishAll: jest.fn(),
    };
    metricsService = {
      recordExamSessionCompleted: jest.fn(),
    };

    useCase = new SubmitSessionUseCase(
      sessionRepository,
      eventPublisher,
      metricsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw an error if the session is not found', async () => {
    sessionRepository.findById.mockResolvedValue(null);
    const command = new SubmitSessionCommand('session-1', 'student-1');

    await expect(useCase.execute(command)).rejects.toThrow(
      ExamSessionNotFoundException,
    );
  });

  it('should submit the session, save it, publish events and record metrics if valid', async () => {
    const mockSession = {
      id: 'session-1',
      studentId: 'student-1',
      status: ExamSessionStatus.IN_PROGRESS,
      licenseCategory: 'B2',
      isPassed: true,
      failedByCritical: false,
      assertOwner: jest.fn(),
      submit: jest.fn().mockImplementation(() => {
        mockSession.status = ExamSessionStatus.COMPLETED;
      }),
      getDomainEvents: jest.fn().mockReturnValue([{ name: 'event1' }]),
      clearDomainEvents: jest.fn(),
      toSnapshot: jest.fn().mockReturnValue({
        id: 'session-1',
        status: ExamSessionStatus.COMPLETED,
        questions: [],
      }),
      questions: [],
    };
    sessionRepository.findById.mockResolvedValue(mockSession as any);

    const command = new SubmitSessionCommand('session-1', 'student-1');
    const result = await useCase.execute(command);

    expect(mockSession.assertOwner).toHaveBeenCalledWith('student-1');
    expect(mockSession.submit).toHaveBeenCalled();
    expect(sessionRepository.save).toHaveBeenCalledWith(mockSession);
    expect(mockSession.getDomainEvents).toHaveBeenCalled();
    expect(mockSession.clearDomainEvents).toHaveBeenCalled();
    expect(eventPublisher.publishAll).toHaveBeenCalledWith([
      { name: 'event1' },
    ]);
    expect(metricsService.recordExamSessionCompleted).toHaveBeenCalledWith({
      licenseCategory: 'B2',
      status: ExamSessionStatus.COMPLETED,
      result: 'pass',
      failedByCritical: false,
    });
    expect(result.status).toBe(ExamSessionStatus.COMPLETED);
  });
});
