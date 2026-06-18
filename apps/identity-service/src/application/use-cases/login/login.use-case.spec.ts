import { LoginUseCase } from './login.use-case';
import { LoginCommand } from './login.command';
import { IdentityProviderPort } from '../../ports/identity-provider.port';
import { AuditPublisherPort } from '../../ports/audit-publisher.port';

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let identityProvider: jest.Mocked<IdentityProviderPort>;
  let auditPublisher: jest.Mocked<AuditPublisherPort>;

  beforeEach(() => {
    identityProvider = {
      login: jest.fn(),
      createUser: jest.fn(),
      assignRealmRole: jest.fn(),
    } as any;

    auditPublisher = {
      publish: jest.fn(),
    };

    useCase = new LoginUseCase(identityProvider, auditPublisher);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return a token set on successful login and not publish to audit db', async () => {
    const mockTokenSet = {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 3600,
      refreshExpiresIn: 1800,
      tokenType: 'Bearer',
    };
    identityProvider.login.mockResolvedValue(mockTokenSet);

    const command = new LoginCommand('testuser', 'password123');
    const result = await useCase.execute(command);

    expect(result).toEqual(mockTokenSet);
    expect(identityProvider.login).toHaveBeenCalledWith(
      'testuser',
      'password123',
    );
    expect(auditPublisher.publish).not.toHaveBeenCalled();
  });

  it('should publish a failure event to the audit db and throw if login fails', async () => {
    const mockError = new Error('Invalid credentials');
    identityProvider.login.mockRejectedValue(mockError);

    const command = new LoginCommand('testuser', 'wrongpassword');

    await expect(useCase.execute(command)).rejects.toThrow(mockError);

    expect(auditPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_LOGIN_FAILED',
        outcome: 'FAILURE',
        actorId: 'testuser',
        metadata: { reason: 'Invalid credentials' },
      }),
    );
  });
});
