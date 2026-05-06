import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CreateUserProfileCommand } from '../../application/use-cases/create-user-profile/create-user-profile.command';
import { CreateUserProfileUseCase } from '../../application/use-cases/create-user-profile/create-user-profile.use-case';
import { SyncUserRoleCommand } from '../../application/use-cases/sync-user-role/sync-user-role.command';
import { SyncUserRoleUseCase } from '../../application/use-cases/sync-user-role/sync-user-role.use-case';
import { UserRole } from '../../domain/aggregates/user-profile/user-profile.types';

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

@Controller()
export class MessagingController {
  private readonly logger = new Logger(MessagingController.name);

  constructor(
    private readonly createUserProfileUseCase: CreateUserProfileUseCase,
    private readonly syncUserRoleUseCase: SyncUserRoleUseCase,
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
}
