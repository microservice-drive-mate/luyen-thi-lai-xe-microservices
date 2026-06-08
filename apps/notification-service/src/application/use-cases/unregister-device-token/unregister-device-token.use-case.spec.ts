import { DeviceTokenRepository } from '../../../domain/repositories/device-token.repository';
import { UnregisterDeviceTokenCommand } from './unregister-device-token.command';
import { UnregisterDeviceTokenUseCase } from './unregister-device-token.use-case';

describe('UnregisterDeviceTokenUseCase', () => {
  it('deletes only the current user device token', async () => {
    const repository = {
      deleteByUserAndToken: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new UnregisterDeviceTokenUseCase(
      repository as unknown as DeviceTokenRepository,
    );

    await useCase.execute(
      new UnregisterDeviceTokenCommand('user-1', 'fcm-token'),
    );

    expect(repository.deleteByUserAndToken).toHaveBeenCalledWith(
      'user-1',
      'fcm-token',
    );
  });
});
