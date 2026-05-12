import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CreateUserProfileCommand } from '../../application/use-cases/create-user-profile/create-user-profile.command';
import { CreateUserProfileUseCase } from '../../application/use-cases/create-user-profile/create-user-profile.use-case';
import { SyncUserRoleCommand } from '../../application/use-cases/sync-user-role/sync-user-role.command';
import { SyncUserRoleUseCase } from '../../application/use-cases/sync-user-role/sync-user-role.use-case';
import { UpdateUserProfileCommand } from '../../application/use-cases/update-user-profile/update-user-profile.command';
import { UpdateUserProfileUseCase } from '../../application/use-cases/update-user-profile/update-user-profile.use-case';
import { UserRole } from '../../domain/aggregates/user-profile/user-profile.types';
import { UserProfileRepository } from '../../domain/repositories/user-profile.repository';

interface IdentityUserCreatedPayload {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
}

interface IdentityUserRoleChangedPayload {
  userId: string;
  newRole: UserRole;
}

interface MediaFileDeletedPayload {
  fileId: string;
  storageKey: string;
  deletedById: string;
}

@Controller()
export class MessagingController {
  private readonly logger = new Logger(MessagingController.name);

  constructor(
    private readonly createUserProfileUseCase: CreateUserProfileUseCase,
    private readonly syncUserRoleUseCase: SyncUserRoleUseCase,
    private readonly updateUserProfileUseCase: UpdateUserProfileUseCase,
    private readonly userProfileRepository: UserProfileRepository,
  ) {}

  @EventPattern('identity.user.created')
  async handleUserCreated(
    @Payload() payload: IdentityUserCreatedPayload,
  ): Promise<void> {
    this.logger.log(
      `Received identity.user.created for userId=${payload.userId}`,
    );
    try {
      await this.createUserProfileUseCase.execute(
        new CreateUserProfileCommand(
          payload.userId,
          payload.fullName,
          payload.email,
          payload.role,
        ),
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle identity.user.created: ${(error as Error).message}`,
      );
    }
  }

  @EventPattern('identity.user.role-changed')
  async handleUserRoleChanged(
    @Payload() payload: IdentityUserRoleChangedPayload,
  ): Promise<void> {
    this.logger.log(
      `Received identity.user.role-changed for userId=${payload.userId}`,
    );
    try {
      await this.syncUserRoleUseCase.execute(
        new SyncUserRoleCommand(payload.userId, payload.newRole),
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle identity.user.role-changed: ${(error as Error).message}`,
      );
    }
  }

  @EventPattern('media.file.deleted')
  async handleMediaFileDeleted(
    @Payload() payload: MediaFileDeletedPayload,
  ): Promise<void> {
    this.logger.log(`Received media.file.deleted for fileId=${payload.fileId}`);
    try {
      const profile = await this.userProfileRepository.findByMediaFileId(
        payload.fileId,
      );
      if (!profile) return;

      await this.updateUserProfileUseCase.execute(
        new UpdateUserProfileCommand(profile.id, {
          avatarUrl: null,
          mediaFileId: null,
        }),
      );
      this.logger.log(
        `Cleared avatarUrl for userId=${profile.id} after file deletion`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle media.file.deleted: ${(error as Error).message}`,
      );
    }
  }
}
