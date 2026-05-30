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
import { buildAuditRequestContext } from '@repo/common';
import { Public, Roles } from 'nest-keycloak-connect';
import { ForgotPasswordCommand } from '../../application/use-cases/forgot-password/forgot-password.command';
import { ForgotPasswordUseCase } from '../../application/use-cases/forgot-password/forgot-password.use-case';
import { LoginCommand } from '../../application/use-cases/login/login.command';
import { LoginUseCase } from '../../application/use-cases/login/login.use-case';
import { LogoutCommand } from '../../application/use-cases/logout/logout.command';
import { LogoutUseCase } from '../../application/use-cases/logout/logout.use-case';
import { RefreshTokenCommand } from '../../application/use-cases/refresh-token/refresh-token.command';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token/refresh-token.use-case';
import { ForgotPasswordRequestDto } from '../dtos/forgot-password.request.dto';
import { ForgotPasswordResponseDto } from '../dtos/forgot-password.response.dto';
import { LoginRequestDto } from '../dtos/login.request.dto';
import { LoginResponseDto } from '../dtos/login.response.dto';
import { LogoutRequestDto } from '../dtos/logout.request.dto';
import { LogoutResponseDto } from '../dtos/logout.response.dto';
import { RefreshTokenRequestDto } from '../dtos/refresh-token.request.dto';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
  ) {}

  @Post('login')
  @Public()
  @ApiBody({ type: LoginRequestDto })
  @ApiOkResponse({ type: LoginResponseDto })
  async login(
    @Body() body: LoginRequestDto,
    @Req() request: Request,
  ): Promise<LoginResponseDto> {
    return this.loginUseCase.execute(
      new LoginCommand(
        body.username,
        body.password,
        // auditContext is populated without a user (public endpoint).
        // actorId defaults to the username for failed-login traceability.
        buildAuditRequestContext(request, undefined),
      ),
    );
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiBody({ type: LogoutRequestDto })
  @ApiOkResponse({ type: LogoutResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Token bị thiếu hoặc không hợp lệ (MSG129)',
  })
  async logout(
    @Req() req: Request,
    @Body() body: LogoutRequestDto,
  ): Promise<LogoutResponseDto> {
    const authHeader = req.headers.authorization ?? '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    return this.logoutUseCase.execute(
      new LogoutCommand(accessToken, body.refreshToken),
    );
  }

  @Post('refresh')
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
    return this.refreshTokenUseCase.execute(
      new RefreshTokenCommand(body.refreshToken),
    );
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: ForgotPasswordRequestDto })
  @ApiOkResponse({ type: ForgotPasswordResponseDto })
  async forgotPassword(
    @Body() body: ForgotPasswordRequestDto,
  ): Promise<ForgotPasswordResponseDto> {
    return this.forgotPasswordUseCase.execute(
      new ForgotPasswordCommand(body.email),
    );
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
