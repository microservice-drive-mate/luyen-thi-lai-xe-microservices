import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async health() {
    return this.appService.healthCheck();
  }

  @Post('test-rabbitMQ')
  async createUser(@Body() body: { email: string; name: string }) {
    const result = await this.appService.createUser(body);

    return result;
  }
}
