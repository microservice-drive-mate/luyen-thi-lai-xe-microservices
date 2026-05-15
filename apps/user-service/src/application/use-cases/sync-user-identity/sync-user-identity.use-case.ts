import { Injectable, Logger } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { UserProfileRepository } from '../../../domain/repositories/user-profile.repository';
import { SyncUserIdentityCommand } from './sync-user-identity.command';

@Injectable()
export class SyncUserIdentityUseCase
  implements IUseCase<SyncUserIdentityCommand, void>
{
  private readonly logger = new Logger(SyncUserIdentityUseCase.name);

  constructor(private readonly userProfileRepository: UserProfileRepository) {}

  async execute(command: SyncUserIdentityCommand): Promise<void> {
    const profile = await this.userProfileRepository.findById(command.userId);
    if (!profile) {
      this.logger.warn(
        `SyncUserIdentity: profile not found for userId=${command.userId}, skipping`,
      );
      return;
    }

    profile.syncIdentity(command.fullName, command.email);
    await this.userProfileRepository.save(profile);
  }
}
