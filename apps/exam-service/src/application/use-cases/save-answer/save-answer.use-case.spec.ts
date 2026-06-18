import { ExamSessionNotFoundException } from '../../../domain/exceptions/exam.exceptions';
import { SaveAnswerCommand } from './save-answer.command';
import { SaveAnswerUseCase } from './save-answer.use-case';

jest.mock('../shared/finalize-expired-session', () => ({
  finalizeExpiredSessionIfNeeded: jest.fn(),
}));

import { finalizeExpiredSessionIfNeeded } from '../shared/finalize-expired-session';

describe('SaveAnswerUseCase', () => {
  let useCase: SaveAnswerUseCase;
  let sessionRepository: any;
  let eventPublisher: any;

  beforeEach(() => {
    sessionRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };
    eventPublisher = {
      publishAll: jest.fn(),
    };
    useCase = new SaveAnswerUseCase(sessionRepository, eventPublisher);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw ExamSessionNotFoundException if session is not found', async () => {
    sessionRepository.findById.mockResolvedValue(null);
    const cmd = new SaveAnswerCommand(
      'session-1',
      'student-1',
      'q-1',
      'opt-1',
      false,
    );
    await expect(useCase.execute(cmd)).rejects.toThrow(
      ExamSessionNotFoundException,
    );
  });

  it('should return finalized session if it expired and was finalized', async () => {
    const mockSession = {
      assertOwner: jest.fn(),
      toSnapshot: jest.fn().mockReturnValue({ questions: [] }),
      questions: [],
    };
    sessionRepository.findById.mockResolvedValue(mockSession);
    (finalizeExpiredSessionIfNeeded as jest.Mock).mockResolvedValue(true);

    const cmd = new SaveAnswerCommand(
      'session-1',
      'student-1',
      'q-1',
      'opt-1',
      false,
    );
    await useCase.execute(cmd);

    expect(mockSession.assertOwner).toHaveBeenCalledWith('student-1');
    expect(finalizeExpiredSessionIfNeeded).toHaveBeenCalledWith(
      mockSession,
      sessionRepository,
      eventPublisher,
    );
  });

  it('should save answer and save session to repository', async () => {
    const mockSession = {
      assertOwner: jest.fn(),
      saveAnswer: jest.fn(),
      toSnapshot: jest.fn().mockReturnValue({ questions: [] }),
      questions: [],
    };
    sessionRepository.findById.mockResolvedValue(mockSession);
    (finalizeExpiredSessionIfNeeded as jest.Mock).mockResolvedValue(false);

    const cmd = new SaveAnswerCommand(
      'session-1',
      'student-1',
      'q-1',
      'opt-1',
      true,
    );
    await useCase.execute(cmd);

    expect(mockSession.saveAnswer).toHaveBeenCalledWith('q-1', 'opt-1', true);
    expect(sessionRepository.save).toHaveBeenCalledWith(mockSession);
  });
});
