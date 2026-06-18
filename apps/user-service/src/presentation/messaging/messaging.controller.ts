import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CreateUserProfileCommand } from '../../application/use-cases/create-user-profile/create-user-profile.command';
import { CreateUserProfileUseCase } from '../../application/use-cases/create-user-profile/create-user-profile.use-case';
import { LockUserCommand } from '../../application/use-cases/lock-user/lock-user.command';
import { LockUserUseCase } from '../../application/use-cases/lock-user/lock-user.use-case';
import { SyncUserIdentityCommand } from '../../application/use-cases/sync-user-identity/sync-user-identity.command';
import { SyncUserIdentityUseCase } from '../../application/use-cases/sync-user-identity/sync-user-identity.use-case';
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

interface IdentityUserUpdatedPayload {
  userId: string;
  email: string;
  fullName: string;
}

interface IdentityUserLockedPayload {
  userId: string;
  locked: boolean;
}

interface IdentityUserDeletedPayload {
  userId: string;
}

interface MediaFileDeletedPayload {
  fileId: string;
  storageKey: string;
}

@Controller()
export class MessagingController {
  private readonly logger = new Logger(MessagingController.name);

  constructor(
    private readonly createUserProfileUseCase: CreateUserProfileUseCase,
    private readonly syncUserIdentityUseCase: SyncUserIdentityUseCase,
    private readonly syncUserRoleUseCase: SyncUserRoleUseCase,
    private readonly lockUserUseCase: LockUserUseCase,
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
      throw error;
    }
  }

  @EventPattern('identity.user.updated')
  async handleUserUpdated(
    @Payload() payload: IdentityUserUpdatedPayload,
  ): Promise<void> {
    this.logger.log(
      `Received identity.user.updated for userId=${payload.userId}`,
    );
    try {
      await this.syncUserIdentityUseCase.execute(
        new SyncUserIdentityCommand(
          payload.userId,
          payload.email,
          payload.fullName,
        ),
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle identity.user.updated: ${(error as Error).message}`,
      );
      throw error;
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
      throw error;
    }
  }

  @EventPattern('identity.user.locked')
  async handleUserLocked(
    @Payload() payload: IdentityUserLockedPayload,
  ): Promise<void> {
    this.logger.log(
      `Received identity.user.locked for userId=${payload.userId}`,
    );
    try {
      await this.lockUserUseCase.execute(
        new LockUserCommand(payload.userId, payload.locked),
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle identity.user.locked: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  @EventPattern('identity.user.deleted')
  async handleUserDeleted(
    @Payload() payload: IdentityUserDeletedPayload,
  ): Promise<void> {
    this.logger.log(
      `Received identity.user.deleted for userId=${payload.userId}`,
    );
    try {
      await this.lockUserUseCase.execute(
        new LockUserCommand(payload.userId, true),
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle identity.user.deleted: ${(error as Error).message}`,
      );
      throw error;
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
      throw error;
    }
  }
}
