import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import { GetUserProfileQuery } from '../../application/use-cases/get-user-profile/get-user-profile.query';
import { GetUserProfileUseCase } from '../../application/use-cases/get-user-profile/get-user-profile.use-case';
import { UpdateUserProfileCommand } from '../../application/use-cases/update-user-profile/update-user-profile.command';
import { UpdateUserProfileUseCase } from '../../application/use-cases/update-user-profile/update-user-profile.use-case';
import { UpdateUserRequestDto } from '../dtos/update-user.request.dto';
import { UserProfileResponseDto } from '../dtos/user-profile.response.dto';

interface JwtPayload {
  sub: string;
}

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
export class UserController {
  constructor(
    private readonly updateUserProfileUseCase: UpdateUserProfileUseCase,
    private readonly getUserProfileUseCase: GetUserProfileUseCase,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get own profile' })
  async getMyProfile(
    @AuthenticatedUser() user: JwtPayload,
  ): Promise<UserProfileResponseDto> {
    const result = await this.getUserProfileUseCase.execute(
      new GetUserProfileQuery(user.sub),
    );
    return UserProfileResponseDto.fromResult(result);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile' })
  async updateMyProfile(
    @AuthenticatedUser() user: JwtPayload,
    @Body() dto: UpdateUserRequestDto,
  ): Promise<UserProfileResponseDto> {
    const result = await this.updateUserProfileUseCase.execute(
      new UpdateUserProfileCommand(user.sub, dto),
    );
    return UserProfileResponseDto.fromResult(result);
  }
}
