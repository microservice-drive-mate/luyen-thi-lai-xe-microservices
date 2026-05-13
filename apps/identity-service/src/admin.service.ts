import { Injectable } from '@nestjs/common';
import { KeycloakAdminService } from './infrastructure/keycloak-admin/keycloak-admin.service';
import { IdentityEventPublisher } from './infrastructure/messaging/identity-event-publisher.service';
import { UserCreatedEvent } from './domain/events/user-created.event';
import { UserRoleChangedEvent } from './domain/events/user-role-changed.event';
import { UserLockedEvent } from './domain/events/user-locked.event';
import { PrismaService } from './prisma/prisma.service';
import { CreateUserRequestDto } from './presentation/dtos/create-user.request.dto';
import { CreateUserResponseDto } from './presentation/dtos/create-user.response.dto';
import { ChangeRoleResponseDto } from './presentation/dtos/change-role.response.dto';
import { LockUserResponseDto } from './presentation/dtos/lock-user.response.dto';
import { UserRole } from './types/user-role.enum';

@Injectable()
export class AdminService {
  constructor(
    private readonly keycloakAdminService: KeycloakAdminService,
    private readonly eventPublisher: IdentityEventPublisher,
    private readonly prisma: PrismaService,
  ) {}

  async createUser(dto: CreateUserRequestDto): Promise<CreateUserResponseDto> {
    const userId = await this.keycloakAdminService.createUser(
      dto.email,
      dto.temporaryPassword,
    );
    await this.keycloakAdminService.assignRealmRole(userId, dto.role);

    // Lưu vào identity_db để có thể lookup sau này
    await this.prisma.identityUser.create({
      data: { id: userId, email: dto.email, name: dto.fullName },
    });

    await this.eventPublisher.publish(
      new UserCreatedEvent(userId, dto.email, dto.fullName, dto.role),
    );

    return { userId, email: dto.email, fullName: dto.fullName, role: dto.role };
  }

  async changeRole(
    userId: string,
    newRole: UserRole,
  ): Promise<ChangeRoleResponseDto> {
    await this.keycloakAdminService.assignRealmRole(userId, newRole);
    await this.eventPublisher.publish(
      new UserRoleChangedEvent(userId, newRole),
    );
    return { userId, role: newRole };
  }

  async lockUser(
    userId: string,
    locked: boolean,
  ): Promise<LockUserResponseDto> {
    await this.keycloakAdminService.setUserEnabled(userId, !locked);
    await this.eventPublisher.publish(new UserLockedEvent(userId, locked));
    return { userId, locked };
  }
}
