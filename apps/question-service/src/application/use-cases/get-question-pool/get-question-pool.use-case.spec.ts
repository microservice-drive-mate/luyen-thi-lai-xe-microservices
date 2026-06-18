import { LicenseCategory } from '../../../domain/aggregates/question/question.types';
import { QuestionPoolResult } from '../shared/question.result';
import { GetQuestionPoolQuery } from './get-question-pool.query';
import { GetQuestionPoolUseCase } from './get-question-pool.use-case';

describe('GetQuestionPoolUseCase', () => {
  let useCase: GetQuestionPoolUseCase;
  let questionRepository: any;

  beforeEach(() => {
    questionRepository = {
      getPool: jest.fn(),
    };
    useCase = new GetQuestionPoolUseCase(questionRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch questions from repository and map to result', async () => {
    const mockQuestions = [
      {
        id: 'q1',
        content: 'Question 1',
        options: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    questionRepository.getPool.mockResolvedValue(mockQuestions);

    const query = new GetQuestionPoolQuery(LicenseCategory.B2, 10);
    const result = await useCase.execute(query);

    expect(questionRepository.getPool).toHaveBeenCalledWith({
      licenseCategory: LicenseCategory.B2,
      size: 10,
      type: undefined,
      difficulty: undefined,
      topicId: undefined,
      isCritical: undefined,
      excludeQuestionIds: undefined,
    });

    expect(result).toBeInstanceOf(QuestionPoolResult);
    expect(result.items.length).toBe(1);
    expect(result.items[0].id).toBe('q1');
  });
});
