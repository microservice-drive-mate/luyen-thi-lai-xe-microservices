import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { DeviceTokenRepository } from '../../../domain/repositories/device-token.repository';
import { UnregisterDeviceTokenCommand } from './unregister-device-token.command';

@Injectable()
export class UnregisterDeviceTokenUseCase
  implements IUseCase<UnregisterDeviceTokenCommand, void>
{
  constructor(private readonly repository: DeviceTokenRepository) {}

  async execute(command: UnregisterDeviceTokenCommand): Promise<void> {
    await this.repository.deleteByUserAndToken(command.userId, command.token);
  }
}
