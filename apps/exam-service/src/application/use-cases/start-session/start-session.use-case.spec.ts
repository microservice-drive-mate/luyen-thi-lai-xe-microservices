import { StartSessionUseCase } from './start-session.use-case';
import { StartSessionCommand } from './start-session.command';
import {
  ExamTemplateNotFoundException,
  ExamTemplateInactiveException,
  StudentProfileInvalidException,
  StudentLicenseMismatchException,
  InsufficientQuestionPoolException,
} from '../../../domain/exceptions/exam.exceptions';

describe('StartSessionUseCase', () => {
  let useCase: StartSessionUseCase;
  let templateRepository: any;
  let sessionRepository: any;
  let questionPoolClient: any;
  let userProfileClient: any;
  let metricsService: any;

  beforeEach(() => {
    templateRepository = {
      findById: jest.fn(),
    };
    sessionRepository = {
      save: jest.fn(),
    };
    questionPoolClient = {
      getPool: jest.fn(),
    };
    userProfileClient = {
      getCurrentStudentProfile: jest.fn(),
    };
    metricsService = {
      recordExamSessionStarted: jest.fn(),
    };

    useCase = new StartSessionUseCase(
      templateRepository,
      sessionRepository,
      questionPoolClient,
      userProfileClient,
      metricsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw an error if the template is not found', async () => {
    templateRepository.findById.mockResolvedValue(null);
    const command = new StartSessionCommand('template-1', 'student-1', 'token');

    await expect(useCase.execute(command)).rejects.toThrow(
      ExamTemplateNotFoundException,
    );
  });

  it('should throw an error if the template is inactive', async () => {
    templateRepository.findById.mockResolvedValue({
      isActive: false,
      isDeleted: false,
    });
    const command = new StartSessionCommand('template-1', 'student-1', 'token');

    await expect(useCase.execute(command)).rejects.toThrow(
      ExamTemplateInactiveException,
    );
  });

  it('should throw an error if the student profile is invalid', async () => {
    templateRepository.findById.mockResolvedValue({
      isActive: true,
      isDeleted: false,
      licenseCategory: 'B2',
    });
    userProfileClient.getCurrentStudentProfile.mockResolvedValue({
      id: 'student-2',
      role: 'STUDENT',
      isActive: true,
    });

    const command = new StartSessionCommand('template-1', 'student-1', 'token');

    await expect(useCase.execute(command)).rejects.toThrow(
      StudentProfileInvalidException,
    );
  });

  it('should throw an error if the student license mismatches the template', async () => {
    templateRepository.findById.mockResolvedValue({
      isActive: true,
      isDeleted: false,
      licenseCategory: 'C',
    });
    userProfileClient.getCurrentStudentProfile.mockResolvedValue({
      id: 'student-1',
      role: 'STUDENT',
      isActive: true,
      studentDetail: { licenseTier: 'B2' },
    });

    const command = new StartSessionCommand('template-1', 'student-1', 'token');

    await expect(useCase.execute(command)).rejects.toThrow(
      StudentLicenseMismatchException,
    );
  });
});
