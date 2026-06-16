import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
import { UserProfileNotFoundException } from '../../../domain/exceptions/user-profile-not-found.exception';
import { UserProfileRepository } from '../../../domain/repositories/user-profile.repository';
import { GetUserProfileResult } from '../get-user-profile/get-user-profile.result';
import { AssignLicenseTierCommand } from './assign-license-tier.command';

@Injectable()
export class AssignLicenseTierUseCase
  implements IUseCase<AssignLicenseTierCommand, GetUserProfileResult>
{
  constructor(private readonly userProfileRepository: UserProfileRepository) {}

  async execute(
    command: AssignLicenseTierCommand,
  ): Promise<GetUserProfileResult> {
    const profile = await this.userProfileRepository.findById(
      command.studentId,
    );
    if (!profile) {
      throw new UserProfileNotFoundException(command.studentId);
    }

    profile.assignLicenseTier(
      command.newLicenseTier,
      command.changedById,
      profile.studentDetail ? undefined : crypto.randomUUID(),
    );

    const auditEvent = createAuditEvent({
      serviceName: 'user-service',
      actorId: command.changedById,
      action: 'USER_LICENSE_ASSIGNED',
      resourceType: 'USER_PROFILE',
      resourceId: profile.id,
      requestContext: command.auditContext,
      metadata: {
        newLicenseTier: command.newLicenseTier,
      },
    });

    await this.userProfileRepository.save(profile, auditEvent);

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
