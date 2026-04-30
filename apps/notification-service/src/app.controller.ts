import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";
import { EventPattern } from "@nestjs/microservices";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @EventPattern("user_created") // Lắng nghe sự kiện này
  handleUserCreated(data: unknown) {
    console.log("Nhận được sự kiện user_created:", data);
    // Logic gửi mail hoặc thông báo ở đây
  }
}
