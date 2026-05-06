import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssignLicenseTierCommand } from '../../application/use-cases/assign-license-tier/assign-license-tier.command';
import { AssignLicenseTierUseCase } from '../../application/use-cases/assign-license-tier/assign-license-tier.use-case';
import { CreateUserProfileCommand } from '../../application/use-cases/create-user-profile/create-user-profile.command';
import { CreateUserProfileUseCase } from '../../application/use-cases/create-user-profile/create-user-profile.use-case';
import { GetUserProfileQuery } from '../../application/use-cases/get-user-profile/get-user-profile.query';
import { GetUserProfileUseCase } from '../../application/use-cases/get-user-profile/get-user-profile.use-case';
import { ListUsersQuery } from '../../application/use-cases/list-users/list-users.query';
import { ListUsersUseCase } from '../../application/use-cases/list-users/list-users.use-case';
import { LockUserCommand } from '../../application/use-cases/lock-user/lock-user.command';
import { LockUserUseCase } from '../../application/use-cases/lock-user/lock-user.use-case';
import { UpdateUserProfileCommand } from '../../application/use-cases/update-user-profile/update-user-profile.command';
import { UpdateUserProfileUseCase } from '../../application/use-cases/update-user-profile/update-user-profile.use-case';
import { AssignLicenseTierRequestDto } from '../dtos/assign-license-tier.request.dto';
import { CreateUserRequestDto } from '../dtos/create-user.request.dto';
import { ListUsersQueryDto } from '../dtos/list-users.query.dto';
import { LockUserRequestDto } from '../dtos/lock-user.request.dto';
import { UpdateUserRequestDto } from '../dtos/update-user.request.dto';
import {
  CreateUserProfileResponseDto,
  PaginatedUsersResponseDto,
  UserProfileResponseDto,
} from '../dtos/user-profile.response.dto';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(
    private readonly createUserProfileUseCase: CreateUserProfileUseCase,
    private readonly updateUserProfileUseCase: UpdateUserProfileUseCase,
    private readonly getUserProfileUseCase: GetUserProfileUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly lockUserUseCase: LockUserUseCase,
    private readonly assignLicenseTierUseCase: AssignLicenseTierUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create user profile (internal — triggered by identity-service via RabbitMQ)',
  })
  async createUser(
    @Body() dto: CreateUserRequestDto,
  ): Promise<CreateUserProfileResponseDto> {
    const result = await this.createUserProfileUseCase.execute(
      new CreateUserProfileCommand(
        dto.id,
        dto.fullName,
        dto.email,
        dto.role,
        dto.phoneNumber,
        dto.dateOfBirth,
        dto.gender,
        dto.address,
        dto.avatarUrl,
        dto.licenseTier,
        dto.enrolledAt,
      ),
    );
    return CreateUserProfileResponseDto.fromResult(result);
  }

  @Get()
  @ApiOperation({ summary: 'List users with optional filters (admin/center manager)' })
  async listUsers(
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedUsersResponseDto> {
    const result = await this.listUsersUseCase.execute(
      new ListUsersQuery(
        query.page,
        query.size,
        query.role,
        query.isActive,
        query.search,
      ),
    );
    return PaginatedUsersResponseDto.fromResult(result);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get own profile' })
  @ApiHeader({ name: 'x-user-id', description: 'Injected by Kong after JWT validation' })
  async getMyProfile(
    @Headers('x-user-id') userId: string,
  ): Promise<UserProfileResponseDto> {
    const result = await this.getUserProfileUseCase.execute(
      new GetUserProfileQuery(userId),
    );
    return UserProfileResponseDto.fromResult(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user profile by ID (admin/center manager)' })
  async getUserProfile(
    @Param('id') id: string,
  ): Promise<UserProfileResponseDto> {
    const result = await this.getUserProfileUseCase.execute(
      new GetUserProfileQuery(id),
    );
    return UserProfileResponseDto.fromResult(result);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile' })
  @ApiHeader({ name: 'x-user-id', description: 'Injected by Kong after JWT validation' })
  async updateMyProfile(
    @Headers('x-user-id') userId: string,
    @Body() dto: UpdateUserRequestDto,
  ): Promise<UserProfileResponseDto> {
    const result = await this.updateUserProfileUseCase.execute(
      new UpdateUserProfileCommand(userId, dto),
    );
    return UserProfileResponseDto.fromResult(result);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user profile by ID (admin)' })
  async updateUserProfile(
    @Param('id') id: string,
    @Body() dto: UpdateUserRequestDto,
  ): Promise<UserProfileResponseDto> {
    const result = await this.updateUserProfileUseCase.execute(
      new UpdateUserProfileCommand(id, dto),
    );
    return UserProfileResponseDto.fromResult(result);
  }

  @Patch(':id/lock')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Lock or unlock a user (admin/center manager)' })
  async lockUser(
    @Param('id') id: string,
    @Body() dto: LockUserRequestDto,
  ): Promise<void> {
    await this.lockUserUseCase.execute(new LockUserCommand(id, dto.lock));
  }

  @Patch(':id/license-tier')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Assign license tier to a student (admin/center manager)',
  })
  @ApiHeader({ name: 'x-user-id', description: 'Injected by Kong — used as changedById for audit trail' })
  async assignLicenseTier(
    @Param('id') id: string,
    @Body() dto: AssignLicenseTierRequestDto,
    @Headers('x-user-id') changedById: string,
  ): Promise<void> {
    await this.assignLicenseTierUseCase.execute(
      new AssignLicenseTierCommand(id, dto.licenseTier, changedById),
    );
  }
}
