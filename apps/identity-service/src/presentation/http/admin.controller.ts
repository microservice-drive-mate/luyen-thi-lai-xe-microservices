import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { buildAuditRequestContext } from '@repo/common';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import { ChangeUserRoleCommand } from '../../application/use-cases/change-user-role/change-user-role.command';
import { ChangeUserRoleUseCase } from '../../application/use-cases/change-user-role/change-user-role.use-case';
import { CreateIdentityUserCommand } from '../../application/use-cases/create-identity-user/create-identity-user.command';
import { CreateIdentityUserUseCase } from '../../application/use-cases/create-identity-user/create-identity-user.use-case';
import { DeleteIdentityUserCommand } from '../../application/use-cases/delete-identity-user/delete-identity-user.command';
import { DeleteIdentityUserUseCase } from '../../application/use-cases/delete-identity-user/delete-identity-user.use-case';
import { GetIdentityUserQuery } from '../../application/use-cases/get-identity-user/get-identity-user.query';
import { GetIdentityUserUseCase } from '../../application/use-cases/get-identity-user/get-identity-user.use-case';
import { ListIdentityUsersQuery } from '../../application/use-cases/list-identity-users/list-identity-users.query';
import { ListIdentityUsersUseCase } from '../../application/use-cases/list-identity-users/list-identity-users.use-case';
import { LockUserCommand } from '../../application/use-cases/lock-user/lock-user.command';
import { LockUserUseCase } from '../../application/use-cases/lock-user/lock-user.use-case';
import { UpdateIdentityUserCommand } from '../../application/use-cases/update-identity-user/update-identity-user.command';
import { UpdateIdentityUserUseCase } from '../../application/use-cases/update-identity-user/update-identity-user.use-case';
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

@ApiTags('Identity Users')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly createIdentityUserUseCase: CreateIdentityUserUseCase,
    private readonly listIdentityUsersUseCase: ListIdentityUsersUseCase,
    private readonly getIdentityUserUseCase: GetIdentityUserUseCase,
    private readonly updateIdentityUserUseCase: UpdateIdentityUserUseCase,
    private readonly changeUserRoleUseCase: ChangeUserRoleUseCase,
    private readonly lockUserUseCase: LockUserUseCase,
    private readonly deleteIdentityUserUseCase: DeleteIdentityUserUseCase,
  ) {}

  @Post('identity-users')
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @ApiBearerAuth()
  @ApiBody({ type: CreateUserRequestDto })
  @ApiCreatedResponse({ type: CreateUserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token không hợp lệ' })
  @ApiForbiddenResponse({ description: 'Không có quyền tạo user' })
  async createUser(
    @Body() body: CreateUserRequestDto,
    @AuthenticatedUser() user: JwtPayload,
    @Req() request: Request,
  ): Promise<CreateUserResponseDto> {
    return this.createIdentityUserUseCase.execute(
      new CreateIdentityUserCommand(
        body.email,
        body.fullName,
        body.role,
        body.temporaryPassword,
        buildAuditRequestContext(request, user),
      ),
    );
  }

  @Get('identity-users')
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @ApiBearerAuth()
  @ApiOkResponse({ type: PaginatedIdentityUsersResponseDto })
  async listUsers(
    @Query() query: ListIdentityUsersQueryDto,
  ): Promise<PaginatedIdentityUsersResponseDto> {
    return this.listIdentityUsersUseCase.execute(
      new ListIdentityUsersQuery(
        query.page,
        query.size,
        query.role,
        query.isActive,
        query.includeDeleted,
        query.search,
      ),
    );
  }

  @Get('identity-users/:id')
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @ApiBearerAuth()
  @ApiOkResponse({ type: IdentityUserResponseDto })
  async getUser(@Param('id') userId: string): Promise<IdentityUserResponseDto> {
    return this.getIdentityUserUseCase.execute(
      new GetIdentityUserQuery(userId),
    );
  }

  @Patch('identity-users/:id')
  @Roles({ roles: ['realm:ADMIN'] })
  @ApiBearerAuth()
  @ApiBody({ type: UpdateIdentityUserRequestDto })
  @ApiOkResponse({ type: IdentityUserResponseDto })
  async updateUser(
    @Param('id') userId: string,
    @Body() body: UpdateIdentityUserRequestDto,
    @AuthenticatedUser() user: JwtPayload,
    @Req() request: Request,
  ): Promise<IdentityUserResponseDto> {
    return this.updateIdentityUserUseCase.execute(
      new UpdateIdentityUserCommand(
        userId,
        body.email,
        body.fullName,
        buildAuditRequestContext(request, user),
      ),
    );
  }

  @Patch('identity-users/:id/role')
  @Roles({ roles: ['realm:ADMIN'] })
  @ApiBearerAuth()
  @ApiBody({ type: ChangeRoleRequestDto })
  @ApiOkResponse({ type: ChangeRoleResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token không hợp lệ' })
  @ApiForbiddenResponse({ description: 'Không có quyền đổi role' })
  async changeRole(
    @Param('id') userId: string,
    @Body() body: ChangeRoleRequestDto,
    @AuthenticatedUser() user: JwtPayload,
    @Req() request: Request,
  ): Promise<ChangeRoleResponseDto> {
    return this.changeUserRoleUseCase.execute(
      new ChangeUserRoleCommand(
        userId,
        body.role,
        buildAuditRequestContext(request, user),
      ),
    );
  }

  @Patch('identity-users/:id/lock')
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @ApiBearerAuth()
  @ApiBody({ type: LockUserRequestDto })
  @ApiOkResponse({ type: LockUserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token không hợp lệ' })
  @ApiForbiddenResponse({ description: 'Không có quyền khóa/mở tài khoản' })
  async lockUser(
    @Param('id') userId: string,
    @Body() body: LockUserRequestDto,
    @AuthenticatedUser() user: JwtPayload,
    @Req() request: Request,
  ): Promise<LockUserResponseDto> {
    return this.lockUserUseCase.execute(
      new LockUserCommand(
        userId,
        body.locked,
        buildAuditRequestContext(request, user),
      ),
    );
  }

  @Delete('identity-users/:id')
  @Roles({ roles: ['realm:ADMIN'] })
  @ApiBearerAuth()
  @ApiBody({ type: DeleteIdentityUserRequestDto, required: false })
  @ApiOkResponse({ type: IdentityUserResponseDto })
  async softDeleteUser(
    @Param('id') userId: string,
    @Body() body: DeleteIdentityUserRequestDto | undefined,
    @AuthenticatedUser() user: JwtPayload,
    @Req() request: Request,
  ): Promise<IdentityUserResponseDto> {
    return this.deleteIdentityUserUseCase.execute(
      new DeleteIdentityUserCommand(
        userId,
        body?.deletedById ?? user.sub ?? null,
        buildAuditRequestContext(request, user),
      ),
    );
  }
}
