import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
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
import { AdminService } from '../../admin.service';
import { CreateUserRequestDto } from '../dtos/create-user.request.dto';
import { CreateUserResponseDto } from '../dtos/create-user.response.dto';
import { ChangeRoleRequestDto } from '../dtos/change-role.request.dto';
import { ChangeRoleResponseDto } from '../dtos/change-role.response.dto';
import { LockUserRequestDto } from '../dtos/lock-user.request.dto';
import { LockUserResponseDto } from '../dtos/lock-user.response.dto';

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
}
