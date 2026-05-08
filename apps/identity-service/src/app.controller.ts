/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { Logger } from '@nestjs/common';
import { Public, Roles } from 'nest-keycloak-connect';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  private readonly logger = new Logger('Identity controller');

  @Get()
  getHello(): string {
    this.logger.log('Đây là một log thông thường');
    this.logger.error('Đây là log lỗi', 'anh mày test thôi');
    this.logger.warn('Đây là log cảnh báo');
    this.logger.debug('Đây là log debug (chỉ hiện ở dev)');
    return this.appService.getHello();
  }

  @Post('login')
  @Public()
  async login(@Body() body: { username: string; password: string }) {
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
