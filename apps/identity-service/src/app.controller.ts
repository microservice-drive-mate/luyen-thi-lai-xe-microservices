import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import type { LoginRequest } from './app.service';
import { Logger } from '@nestjs/common';

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

  @Get('health')
  async health() {
    return this.appService.healthCheck();
  }

  @Post('login')
  async login(@Body() body: LoginRequest) {
    return this.appService.login(body);
  }

  @Post('test-rabbitMQ')
  async createUser(@Body() body: { email: string; name: string }) {
    const result = await this.appService.createUser(body);
    return result;
  }
}
