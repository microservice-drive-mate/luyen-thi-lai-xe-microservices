import { UserRole } from '../../../domain/aggregates/user-profile/user-profile.types';
import { UserAlreadyExistsException } from '../../../domain/exceptions/user-already-exists.exception';
import { CreateUserProfileCommand } from './create-user-profile.command';
import { CreateUserProfileUseCase } from './create-user-profile.use-case';

describe('CreateUserProfileUseCase', () => {
  let useCase: CreateUserProfileUseCase;
  let userProfileRepository: any;
  let metricsService: any;

  beforeEach(() => {
    userProfileRepository = {
      findById: jest.fn(),
      existsByEmail: jest.fn(),
      save: jest.fn(),
    };
    metricsService = {
      recordUserCreated: jest.fn(),
    };

    useCase = new CreateUserProfileUseCase(
      userProfileRepository,
      metricsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return existing profile if id already exists', async () => {
    userProfileRepository.findById.mockResolvedValue({
      id: 'user-1',
      fullName: 'John',
      email: 'john@test.com',
      role: UserRole.STUDENT,
    });

    const command = new CreateUserProfileCommand(
      'user-1',
      'John',
      'john@test.com',
      UserRole.STUDENT,
    );
    const result = await useCase.execute(command);

    expect(result.id).toBe('user-1');
    expect(userProfileRepository.existsByEmail).not.toHaveBeenCalled();
    expect(userProfileRepository.save).not.toHaveBeenCalled();
  });

  it('should throw if email already exists', async () => {
    userProfileRepository.findById.mockResolvedValue(null);
    userProfileRepository.existsByEmail.mockResolvedValue(true);

    const command = new CreateUserProfileCommand(
      'user-1',
      'John',
      'john@test.com',
      UserRole.STUDENT,
    );
    await expect(useCase.execute(command)).rejects.toThrow(
      UserAlreadyExistsException,
    );
  });

  it('should create profile, save it, and record metric', async () => {
    userProfileRepository.findById.mockResolvedValue(null);
    userProfileRepository.existsByEmail.mockResolvedValue(false);

    const command = new CreateUserProfileCommand(
      'user-1',
      'John',
      'john@test.com',
      UserRole.STUDENT,
    );
    const result = await useCase.execute(command);

    expect(result.id).toBe('user-1');
    expect(userProfileRepository.save).toHaveBeenCalled();
    expect(metricsService.recordUserCreated).toHaveBeenCalledWith({
      role: UserRole.STUDENT,
      source: 'identity-event',
    });
  });
});
