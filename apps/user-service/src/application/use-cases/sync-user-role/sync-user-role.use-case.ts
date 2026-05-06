import { Injectable, Logger } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { UserProfileRepository } from '../../../domain/repositories/user-profile.repository';
import { SyncUserRoleCommand } from './sync-user-role.command';

@Injectable()
export class SyncUserRoleUseCase implements IUseCase<
  SyncUserRoleCommand,
  void
> {
  private readonly logger = new Logger(SyncUserRoleUseCase.name);

  constructor(private readonly userProfileRepository: UserProfileRepository) {}

  async execute(command: SyncUserRoleCommand): Promise<void> {
    const profile = await this.userProfileRepository.findById(command.userId);
    if (!profile) {
      this.logger.warn(
        `SyncUserRole: profile not found for userId=${command.userId}, skipping`,
      );
      return;
    }

    profile.syncRole(command.newRole);
    await this.userProfileRepository.save(profile);
  }
}
