import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { UserProfile } from '../../../domain/aggregates/user-profile/user-profile.aggregate';
import { UserAlreadyExistsException } from '../../../domain/exceptions/user-already-exists.exception';
import { UserProfileRepository } from '../../../domain/repositories/user-profile.repository';
import { CreateUserProfileCommand } from './create-user-profile.command';
import { UserRole } from '../../../domain/aggregates/user-profile/user-profile.types';

export class CreateUserProfileResult {
  constructor(
    readonly id: string,
    readonly fullName: string,
    readonly email: string,
    readonly role: UserRole,
  ) {}
}

@Injectable()
export class CreateUserProfileUseCase
  implements IUseCase<CreateUserProfileCommand, CreateUserProfileResult>
{
  constructor(private readonly userProfileRepository: UserProfileRepository) {}

  async execute(
    command: CreateUserProfileCommand,
  ): Promise<CreateUserProfileResult> {
    const exists = await this.userProfileRepository.existsByEmail(
      command.email,
    );
    if (exists) {
      throw new UserAlreadyExistsException(command.email);
    }

    const profile = UserProfile.create({
      id: command.id,
      fullName: command.fullName,
      email: command.email,
      role: command.role,
      phoneNumber: command.phoneNumber,
      dateOfBirth: command.dateOfBirth,
      gender: command.gender,
      address: command.address,
      avatarUrl: command.avatarUrl,
      enrolledAt: command.enrolledAt,
    });

    await this.userProfileRepository.save(profile);

    return new CreateUserProfileResult(
      profile.id,
      profile.fullName,
      profile.email,
      profile.role,
    );
  }
}
