import { IdentityUser } from '../../../domain/aggregates/identity-user/identity-user.aggregate';
import { CreateIdentityUserCommand } from './create-identity-user.command';
import { CreateIdentityUserUseCase } from './create-identity-user.use-case';

describe('CreateIdentityUserUseCase', () => {
  let useCase: CreateIdentityUserUseCase;
  let identityProvider: any;
  let identityUserRepository: any;
  let eventPublisher: any;
  let auditPublisher: any;

  beforeEach(() => {
    identityProvider = {
      createUser: jest.fn(),
      assignRealmRole: jest.fn(),
    };
    identityUserRepository = {
      save: jest.fn(),
    };
    eventPublisher = {
      publish: jest.fn(),
    };
    auditPublisher = {
      publish: jest.fn(),
    };

    useCase = new CreateIdentityUserUseCase(
      identityProvider,
      identityUserRepository,
      eventPublisher,
      auditPublisher,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create user, assign role, save to DB, publish events and audit log', async () => {
    identityProvider.createUser.mockResolvedValue('user-123');
    identityProvider.assignRealmRole.mockResolvedValue();
    identityUserRepository.save.mockResolvedValue();

    const command = new CreateIdentityUserCommand(
      'test@test.com',
      'John Doe',
      'STUDENT' as any,
      'password123',
      {
        actorId: 'admin-1',
      },
    );

    const result = await useCase.execute(command);

    expect(result.userId).toBe('user-123');
    expect(result.email).toBe('test@test.com');
    expect(identityProvider.createUser).toHaveBeenCalledWith(
      'test@test.com',
      'password123',
      'John Doe',
    );
    expect(identityProvider.assignRealmRole).toHaveBeenCalledWith(
      'user-123',
      'STUDENT',
    );
    expect(identityUserRepository.save).toHaveBeenCalledWith(
      expect.any(IdentityUser),
    );

    expect(auditPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'IDENTITY_USER_CREATED',
        outcome: 'SUCCESS',
        resourceId: 'user-123',
        metadata: {
          email: 'test@test.com',
          fullName: 'John Doe',
          role: 'STUDENT',
        },
      }),
    );
  });
});
