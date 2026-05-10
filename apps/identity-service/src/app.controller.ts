/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public, Roles } from 'nest-keycloak-connect';
import { LoginRequestDto } from './login.request.dto';
import { LoginResponseDto } from './login.response.dto';

@ApiTags('auth')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('login')
  @Public()
  @ApiBody({ type: LoginRequestDto })
  @ApiOkResponse({ type: LoginResponseDto })
  async login(@Body() body: LoginRequestDto): Promise<LoginResponseDto> {
    return this.appService.login(body.username, body.password);
  }

  @Get('public')
  @Public()
  getPublic() {
    return { message: 'Đây là API Public, ai cũng xem được!' };
  }

  // 2. API yêu cầu phải đăng nhập (Có token hợp lệ là được)
  @Get('private')
  getPrivate() {
    return {
      message: 'Chào bạn, bạn đã đăng nhập thành công!',
    };
  }

  // 3. API yêu cầu Role cụ thể (Ví dụ: ADMIN)
  @Get('admin')
  @Roles({ roles: ['realm:ADMIN'] }) // Kiểm tra role ADMIN ở mức Realm
  getAdmin() {
    return { message: 'Chào Sếp! Chỉ ADMIN mới thấy được dòng này.' };
  }
}
