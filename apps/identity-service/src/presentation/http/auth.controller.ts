import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public, Roles } from 'nest-keycloak-connect';
import { AppService } from '../../app.service';
import { LoginRequestDto } from '../dtos/login.request.dto';
import { LoginResponseDto } from '../dtos/login.response.dto';
import { LogoutRequestDto } from '../dtos/logout.request.dto';
import { LogoutResponseDto } from '../dtos/logout.response.dto';
import { RefreshTokenRequestDto } from '../dtos/refresh-token.request.dto';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly appService: AppService) {}

  @Post('login')
  @Public()
  @ApiBody({ type: LoginRequestDto })
  @ApiOkResponse({ type: LoginResponseDto })
  async login(@Body() body: LoginRequestDto): Promise<LoginResponseDto> {
    return this.appService.login(body.username, body.password);
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiBody({ type: LogoutRequestDto })
  @ApiOkResponse({ type: LogoutResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token missing or invalid (MSG129)' })
  async logout(
    @Req() req: Request,
    @Body() body: LogoutRequestDto,
  ): Promise<LogoutResponseDto> {
    const authHeader = req.headers.authorization ?? '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    return this.appService.logout(accessToken, body.refreshToken);
  }

  @Post('auth/refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: RefreshTokenRequestDto })
  @ApiOkResponse({ type: LoginResponseDto, description: 'Token mới' })
  @ApiUnauthorizedResponse({
    description: 'Refresh token không hợp lệ hoặc đã hết hạn',
  })
  async refresh(
    @Body() body: RefreshTokenRequestDto,
  ): Promise<LoginResponseDto> {
    return this.appService.refreshToken(body.refreshToken);
  }

  @Get('public')
  @Public()
  getPublic(): { message: string } {
    return { message: 'Đây là API Public, ai cũng xem được!' };
  }

  @Get('private')
  @ApiBearerAuth()
  getPrivate(): { message: string } {
    return { message: 'Chào bạn, bạn đã đăng nhập thành công!' };
  }

  @Get('admin-check')
  @ApiBearerAuth()
  @Roles({ roles: ['realm:ADMIN'] })
  getAdminCheck(): { message: string } {
    return { message: 'Chào Sếp! Chỉ ADMIN mới thấy được dòng này.' };
  }
}
