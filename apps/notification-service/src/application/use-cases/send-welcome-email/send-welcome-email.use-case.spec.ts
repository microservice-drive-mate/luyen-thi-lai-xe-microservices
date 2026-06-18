import { NotificationType } from '../../../domain/repositories/notification.repository';
import { SendWelcomeEmailCommand } from './send-welcome-email.command';
import { SendWelcomeEmailUseCase } from './send-welcome-email.use-case';

describe('SendWelcomeEmailUseCase', () => {
  let useCase: SendWelcomeEmailUseCase;
  const mockDispatcher = { dispatch: jest.fn() };

  beforeEach(() => {
    useCase = new SendWelcomeEmailUseCase(mockDispatcher as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should format greeting with fullName if provided and dispatch notification', async () => {
    mockDispatcher.dispatch.mockResolvedValue([]);
    const command = new SendWelcomeEmailCommand(
      'user-1',
      'test@test.com',
      'John Doe',
    );

    await useCase.execute(command);

    expect(mockDispatcher.dispatch).toHaveBeenCalledWith({
      eventType: 'identity.user.created',
      userId: 'user-1',
      recipientEmail: 'test@test.com',
      title: 'Chào mừng đến với Luyện thi lái xe',
      body: expect.stringContaining('Xin chào John Doe,'),
      data: { email: 'test@test.com' },
      channels: [NotificationType.IN_APP, NotificationType.EMAIL],
      retryCount: undefined,
    });
  });

  it('should format generic greeting if no fullName is provided', async () => {
    mockDispatcher.dispatch.mockResolvedValue([]);
    const command = new SendWelcomeEmailCommand('user-2', 'test2@test.com');

    await useCase.execute(command);

    expect(mockDispatcher.dispatch).toHaveBeenCalledWith({
      eventType: 'identity.user.created',
      userId: 'user-2',
      recipientEmail: 'test2@test.com',
      title: 'Chào mừng đến với Luyện thi lái xe',
      body: expect.stringContaining('Xin chào,'),
      data: { email: 'test2@test.com' },
      channels: [NotificationType.IN_APP, NotificationType.EMAIL],
      retryCount: undefined,
    });
  });
});
