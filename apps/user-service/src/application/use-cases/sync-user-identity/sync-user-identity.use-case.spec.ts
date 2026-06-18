import { SyncUserIdentityCommand } from './sync-user-identity.command';
import { SyncUserIdentityUseCase } from './sync-user-identity.use-case';

describe('SyncUserIdentityUseCase', () => {
  let useCase: SyncUserIdentityUseCase;
  let userProfileRepository: any;

  beforeEach(() => {
    userProfileRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };

    useCase = new SyncUserIdentityUseCase(userProfileRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should skip if profile is not found', async () => {
    userProfileRepository.findById.mockResolvedValue(null);

    const command = new SyncUserIdentityCommand(
      'user-1',
      'john@test.com',
      'John',
    );
    await useCase.execute(command);

    expect(userProfileRepository.findById).toHaveBeenCalledWith('user-1');
    expect(userProfileRepository.save).not.toHaveBeenCalled();
  });

  it('should sync identity and save if profile is found', async () => {
    const mockProfile = {
      syncIdentity: jest.fn(),
    };
    userProfileRepository.findById.mockResolvedValue(mockProfile);

    const command = new SyncUserIdentityCommand(
      'user-1',
      'john@test.com',
      'John',
    );
    await useCase.execute(command);

    expect(mockProfile.syncIdentity).toHaveBeenCalledWith(
      'John',
      'john@test.com',
    );
    expect(userProfileRepository.save).toHaveBeenCalledWith(mockProfile);
  });
});
