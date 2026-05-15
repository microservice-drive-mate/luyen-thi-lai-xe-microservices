import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { Roles } from 'nest-keycloak-connect';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import { AdminService } from '../../admin.service';
import { CreateUserRequestDto } from '../dtos/create-user.request.dto';
import { CreateUserResponseDto } from '../dtos/create-user.response.dto';
import { ChangeRoleRequestDto } from '../dtos/change-role.request.dto';
import { ChangeRoleResponseDto } from '../dtos/change-role.response.dto';
import { DeleteIdentityUserRequestDto } from '../dtos/delete-identity-user.request.dto';
import {
  IdentityUserResponseDto,
  PaginatedIdentityUsersResponseDto,
} from '../dtos/identity-user.response.dto';
import { ListIdentityUsersQueryDto } from '../dtos/list-identity-users.query.dto';
import { LockUserRequestDto } from '../dtos/lock-user.request.dto';
import { LockUserResponseDto } from '../dtos/lock-user.response.dto';
import { UpdateIdentityUserRequestDto } from '../dtos/update-identity-user.request.dto';

interface JwtPayload {
  sub?: string;
}

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('users')
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @ApiBearerAuth()
  @ApiBody({ type: CreateUserRequestDto })
  @ApiCreatedResponse({ type: CreateUserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token không hợp lệ' })
  @ApiForbiddenResponse({ description: 'Không có quyền tạo user' })
  async createUser(
    @Body() body: CreateUserRequestDto,
  ): Promise<CreateUserResponseDto> {
    return this.adminService.createUser(body);
  }

  @Get('users')
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @ApiBearerAuth()
  @ApiOkResponse({ type: PaginatedIdentityUsersResponseDto })
  async listUsers(
    @Query() query: ListIdentityUsersQueryDto,
  ): Promise<PaginatedIdentityUsersResponseDto> {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id')
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @ApiBearerAuth()
  @ApiOkResponse({ type: IdentityUserResponseDto })
  async getUser(@Param('id') userId: string): Promise<IdentityUserResponseDto> {
    return this.adminService.getUser(userId);
  }

  @Patch('users/:id')
  @Roles({ roles: ['realm:ADMIN'] })
  @ApiBearerAuth()
  @ApiBody({ type: UpdateIdentityUserRequestDto })
  @ApiOkResponse({ type: IdentityUserResponseDto })
  async updateUser(
    @Param('id') userId: string,
    @Body() body: UpdateIdentityUserRequestDto,
  ): Promise<IdentityUserResponseDto> {
    return this.adminService.updateUser(userId, body);
  }

  @Patch('users/:id/role')
  @Roles({ roles: ['realm:ADMIN'] })
  @ApiBearerAuth()
  @ApiBody({ type: ChangeRoleRequestDto })
  @ApiOkResponse({ type: ChangeRoleResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token không hợp lệ' })
  @ApiForbiddenResponse({ description: 'Không có quyền đổi role' })
  async changeRole(
    @Param('id') userId: string,
    @Body() body: ChangeRoleRequestDto,
  ): Promise<ChangeRoleResponseDto> {
    return this.adminService.changeRole(userId, body.role);
  }

  @Patch('users/:id/lock')
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @ApiBearerAuth()
  @ApiBody({ type: LockUserRequestDto })
  @ApiOkResponse({ type: LockUserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token không hợp lệ' })
  @ApiForbiddenResponse({ description: 'Không có quyền khóa/mở tài khoản' })
  async lockUser(
    @Param('id') userId: string,
    @Body() body: LockUserRequestDto,
  ): Promise<LockUserResponseDto> {
    return this.adminService.lockUser(userId, body.locked);
  }

  @Delete('users/:id')
  @Roles({ roles: ['realm:ADMIN'] })
  @ApiBearerAuth()
  @ApiBody({ type: DeleteIdentityUserRequestDto, required: false })
  @ApiOkResponse({ type: IdentityUserResponseDto })
  async softDeleteUser(
    @Param('id') userId: string,
    @Body() body: DeleteIdentityUserRequestDto | undefined,
    @AuthenticatedUser() user: JwtPayload,
  ): Promise<IdentityUserResponseDto> {
    return this.adminService.softDeleteUser(
      userId,
      body?.deletedById ?? user.sub ?? null,
    );
  }
}
