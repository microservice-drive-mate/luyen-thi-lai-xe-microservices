import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import { RegisterDeviceTokenCommand } from '../../application/use-cases/register-device-token/register-device-token.command';
import { RegisterDeviceTokenUseCase } from '../../application/use-cases/register-device-token/register-device-token.use-case';
import { UnregisterDeviceTokenCommand } from '../../application/use-cases/unregister-device-token/unregister-device-token.command';
import { UnregisterDeviceTokenUseCase } from '../../application/use-cases/unregister-device-token/unregister-device-token.use-case';
import {
  DeviceTokenResponseDto,
  RegisterDeviceTokenRequestDto,
  UnregisterDeviceTokenParamsDto,
} from '../dtos/device-token.dtos';

interface JwtPayload {
  sub?: string;
}

@ApiTags('Device Tokens')
@ApiBearerAuth()
@Controller('notifications/devices')
export class DeviceTokenController {
  constructor(
    private readonly registerDeviceTokenUseCase: RegisterDeviceTokenUseCase,
    private readonly unregisterDeviceTokenUseCase: UnregisterDeviceTokenUseCase,
  ) {}

  @Post()
  @Roles({
    roles: [
      'realm:ADMIN',
      'realm:CENTER_MANAGER',
      'realm:INSTRUCTOR',
      'realm:STUDENT',
    ],
  })
  @ApiOperation({
    summary: 'Register current user device token to receive push notifications',
  })
  async register(
    @AuthenticatedUser() user: JwtPayload,
    @Body() dto: RegisterDeviceTokenRequestDto,
  ): Promise<DeviceTokenResponseDto> {
    const record = await this.registerDeviceTokenUseCase.execute(
      new RegisterDeviceTokenCommand(user.sub ?? '', dto.token, dto.platform),
    );
    return DeviceTokenResponseDto.fromRecord(record);
  }

  @Delete(':token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles({
    roles: [
      'realm:ADMIN',
      'realm:CENTER_MANAGER',
      'realm:INSTRUCTOR',
      'realm:STUDENT',
    ],
  })
  @ApiOperation({
    summary: 'Unregister current user device token by its value',
  })
  async unregister(
    @AuthenticatedUser() user: JwtPayload,
    @Param() params: UnregisterDeviceTokenParamsDto,
  ): Promise<void> {
    await this.unregisterDeviceTokenUseCase.execute(
      new UnregisterDeviceTokenCommand(user.sub ?? '', params.token),
    );
  }
}
