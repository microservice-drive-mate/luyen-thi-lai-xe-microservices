import { Controller, Get, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { EventPattern } from '@nestjs/microservices';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @EventPattern('user_created') // Lắng nghe sự kiện này
  handleUserCreated(data: unknown) {
    this.logger.log(`Received user_created event: ${JSON.stringify(data)}`);
    // Logic gửi mail hoặc thông báo ở đây
  }
}
