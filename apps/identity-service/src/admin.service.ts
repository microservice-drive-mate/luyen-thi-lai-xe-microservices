import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KeycloakAdminService } from './infrastructure/keycloak-admin/keycloak-admin.service';
import { IdentityEventPublisher } from './infrastructure/messaging/identity-event-publisher.service';
import { UserCreatedEvent } from './domain/events/user-created.event';
import { UserDeletedEvent } from './domain/events/user-deleted.event';
import { UserRoleChangedEvent } from './domain/events/user-role-changed.event';
import { UserUpdatedEvent } from './domain/events/user-updated.event';
import { UserLockedEvent } from './domain/events/user-locked.event';
import { PrismaService } from './prisma/prisma.service';
import { CreateUserRequestDto } from './presentation/dtos/create-user.request.dto';
import { CreateUserResponseDto } from './presentation/dtos/create-user.response.dto';
import { ChangeRoleResponseDto } from './presentation/dtos/change-role.response.dto';
import {
  IdentityUserResponseDto,
  PaginatedIdentityUsersResponseDto,
} from './presentation/dtos/identity-user.response.dto';
import { ListIdentityUsersQueryDto } from './presentation/dtos/list-identity-users.query.dto';
import { LockUserResponseDto } from './presentation/dtos/lock-user.response.dto';
import { UpdateIdentityUserRequestDto } from './presentation/dtos/update-identity-user.request.dto';
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
      dto.fullName,
    );
    await this.keycloakAdminService.assignRealmRole(userId, dto.role);

    // Lưu vào identity_db để có thể lookup sau này
    await this.prisma.identityUser.create({
      data: {
        id: userId,
        email: dto.email,
        name: dto.fullName,
        role: dto.role,
      },
    });

    await this.eventPublisher.publish(
      new UserCreatedEvent(userId, dto.email, dto.fullName, dto.role),
    );

    return { userId, email: dto.email, fullName: dto.fullName, role: dto.role };
  }

  async listUsers(
    query: ListIdentityUsersQueryDto,
  ): Promise<PaginatedIdentityUsersResponseDto> {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const where = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.includeDeleted ? {} : { isDeleted: false }),
      ...(query.search
        ? {
            OR: [
              {
                email: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                name: { contains: query.search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.identityUser.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.identityUser.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page,
      size,
    };
  }

  async getUser(userId: string): Promise<IdentityUserResponseDto> {
    const user = await this.prisma.identityUser.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('Identity user not found');
    return this.toResponse(user);
  }

  async updateUser(
    userId: string,
    dto: UpdateIdentityUserRequestDto,
  ): Promise<IdentityUserResponseDto> {
    const existing = await this.prisma.identityUser.findUnique({
      where: { id: userId },
    });
    if (!existing) throw new NotFoundException('Identity user not found');
    if (existing.isDeleted) {
      throw new BadRequestException('Cannot update a deleted identity user');
    }

    const email = dto.email ?? existing.email;
    const fullName = dto.fullName ?? existing.name;
    await this.keycloakAdminService.updateUser(userId, { email, fullName });

    const updated = await this.prisma.identityUser.update({
      where: { id: userId },
      data: { email, name: fullName },
    });

    await this.eventPublisher.publish(
      new UserUpdatedEvent(userId, updated.email, updated.name),
    );

    return this.toResponse(updated);
  }

  async changeRole(
    userId: string,
    newRole: UserRole,
  ): Promise<ChangeRoleResponseDto> {
    await this.keycloakAdminService.assignRealmRole(userId, newRole);
    await this.prisma.identityUser.update({
      where: { id: userId },
      data: { role: newRole },
    });
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
    await this.prisma.identityUser.update({
      where: { id: userId },
      data: { isActive: !locked },
    });
    await this.eventPublisher.publish(new UserLockedEvent(userId, locked));
    return { userId, locked };
  }

  async softDeleteUser(
    userId: string,
    deletedById: string | null,
  ): Promise<IdentityUserResponseDto> {
    const existing = await this.prisma.identityUser.findUnique({
      where: { id: userId },
    });
    if (!existing) throw new NotFoundException('Identity user not found');
    if (existing.isDeleted) return this.toResponse(existing);

    await this.keycloakAdminService.setUserEnabled(userId, false);
    const deleted = await this.prisma.identityUser.update({
      where: { id: userId },
      data: {
        isActive: false,
        isDeleted: true,
        deletedAt: new Date(),
        deletedById,
      },
    });

    await this.eventPublisher.publish(
      new UserDeletedEvent(userId, deletedById),
    );
    return this.toResponse(deleted);
  }

  private toResponse(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    isDeleted: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): IdentityUserResponseDto {
    return {
      userId: user.id,
      email: user.email,
      fullName: user.name,
      role: user.role as UserRole,
      isActive: user.isActive,
      isDeleted: user.isDeleted,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
