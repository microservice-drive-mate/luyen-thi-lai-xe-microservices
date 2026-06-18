import { RefreshTokenCommand } from './refresh-token.command';
import { RefreshTokenUseCase } from './refresh-token.use-case';

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase;
  let identityProvider: any;

  beforeEach(() => {
    identityProvider = {
      refreshToken: jest.fn(),
    };
    useCase = new RefreshTokenUseCase(identityProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call identityProvider.refreshToken with the provided token', async () => {
    const mockTokenSet = { accessToken: 'access', refreshToken: 'refresh' };
    identityProvider.refreshToken.mockResolvedValue(mockTokenSet);

    const command = new RefreshTokenCommand('old-refresh-token');
    const result = await useCase.execute(command);

    expect(identityProvider.refreshToken).toHaveBeenCalledWith(
      'old-refresh-token',
    );
    expect(result).toEqual(mockTokenSet);
  });
});
