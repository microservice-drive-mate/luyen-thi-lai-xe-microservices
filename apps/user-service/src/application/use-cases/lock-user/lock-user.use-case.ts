import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { UserProfileNotFoundException } from '../../../domain/exceptions/user-profile-not-found.exception';
import { UserProfileRepository } from '../../../domain/repositories/user-profile.repository';
import { LockUserCommand } from './lock-user.command';

@Injectable()
export class LockUserUseCase implements IUseCase<LockUserCommand, void> {
  constructor(private readonly userProfileRepository: UserProfileRepository) {}

  async execute(command: LockUserCommand): Promise<void> {
    const profile = await this.userProfileRepository.findById(command.targetUserId);
    if (!profile) {
      throw new UserProfileNotFoundException(command.targetUserId);
    }

    if (command.lock) {
      profile.deactivate();
    } else {
      profile.activate();
    }

    await this.userProfileRepository.save(profile);
  }
}
