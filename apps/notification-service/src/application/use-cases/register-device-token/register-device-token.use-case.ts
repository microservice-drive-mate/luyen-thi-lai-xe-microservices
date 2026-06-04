import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import crypto from 'node:crypto';
import {
  DeviceToken,
  DeviceTokenRecord,
  DeviceTokenRepository,
} from '../../../domain/repositories/device-token.repository';
import { RegisterDeviceTokenCommand } from './register-device-token.command';

@Injectable()
export class RegisterDeviceTokenUseCase
  implements IUseCase<RegisterDeviceTokenCommand, DeviceTokenRecord>
{
  constructor(private readonly repository: DeviceTokenRepository) {}

  async execute(
    command: RegisterDeviceTokenCommand,
  ): Promise<DeviceTokenRecord> {
    const token = DeviceToken.register({
      id: crypto.randomUUID(),
      userId: command.userId,
      token: command.token,
      platform: command.platform,
    });
    return this.repository.upsert(token);
  }
}
