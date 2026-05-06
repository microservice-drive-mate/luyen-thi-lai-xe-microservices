import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { UserProfileNotFoundException } from '../../../domain/exceptions/user-profile-not-found.exception';
import { UserProfileRepository } from '../../../domain/repositories/user-profile.repository';
import { GetUserProfileQuery } from './get-user-profile.query';
import { GetUserProfileResult } from './get-user-profile.result';

@Injectable()
export class GetUserProfileUseCase
  implements IUseCase<GetUserProfileQuery, GetUserProfileResult>
{
  constructor(private readonly userProfileRepository: UserProfileRepository) {}

  async execute(query: GetUserProfileQuery): Promise<GetUserProfileResult> {
    const profile = await this.userProfileRepository.findById(query.userId);
    if (!profile) {
      throw new UserProfileNotFoundException(query.userId);
    }

    return new GetUserProfileResult(
      profile.id,
      profile.fullName,
      profile.email,
      profile.phoneNumber,
      profile.dateOfBirth,
      profile.avatarUrl,
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
