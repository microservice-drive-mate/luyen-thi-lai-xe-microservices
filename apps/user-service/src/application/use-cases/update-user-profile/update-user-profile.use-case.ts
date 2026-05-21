import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { UserProfileNotFoundException } from '../../../domain/exceptions/user-profile-not-found.exception';
import { UserProfileRepository } from '../../../domain/repositories/user-profile.repository';
import { EventPublisher } from '../../ports/event-publisher.port';
import { GetUserProfileResult } from '../get-user-profile/get-user-profile.result';
import { UpdateUserProfileCommand } from './update-user-profile.command';

@Injectable()
export class UpdateUserProfileUseCase
  implements IUseCase<UpdateUserProfileCommand, GetUserProfileResult>
{
  constructor(
    private readonly userProfileRepository: UserProfileRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(
    command: UpdateUserProfileCommand,
  ): Promise<GetUserProfileResult> {
    const profile = await this.userProfileRepository.findById(
      command.targetUserId,
    );
    if (!profile) {
      throw new UserProfileNotFoundException(command.targetUserId);
    }

    profile.update({
      fullName: command.fullName,
      phoneNumber: command.phoneNumber,
      dateOfBirth: command.dateOfBirth,
      avatarUrl: command.avatarUrl,
      mediaFileId: command.mediaFileId,
      gender: command.gender,
      address: command.address,
      notes: command.notes,
    });

    await this.userProfileRepository.save(profile);

    await this.eventPublisher.publishAll(profile.getDomainEvents());
    profile.clearDomainEvents();

    return new GetUserProfileResult(
      profile.id,
      profile.fullName,
      profile.email,
      profile.phoneNumber,
      profile.dateOfBirth,
      profile.avatarUrl,
      profile.mediaFileId,
      profile.gender,
      profile.address,
      profile.role,
      profile.isActive,
      profile.createdAt,
      profile.studentDetail
        ? {
            licenseTier: profile.studentDetail.licenseTier,
            enrolledAt: profile.studentDetail.enrolledAt,
            notes: profile.studentDetail.notes,
          }
        : null,
    );
  }
}
