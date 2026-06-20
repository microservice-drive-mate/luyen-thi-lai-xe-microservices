import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { UserProfileRepository } from '../../../domain/repositories/user-profile.repository';
import { DeleteUserProfileCommand } from './delete-user-profile.command';

@Injectable()
export class DeleteUserProfileUseCase
  implements IUseCase<DeleteUserProfileCommand, void>
{
  constructor(private readonly userProfileRepository: UserProfileRepository) {}

  async execute(command: DeleteUserProfileCommand): Promise<void> {
    const exists = await this.userProfileRepository.existsById(command.userId);
    if (!exists) {
      return; // Idempotent: if it doesn't exist, just succeed
    }
    await this.userProfileRepository.delete(command.userId);
  }
}
