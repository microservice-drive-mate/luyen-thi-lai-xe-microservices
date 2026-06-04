import { Controller, Get, Header, SetMetadata } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class ScalarLandingController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Header('content-type', 'text/html; charset=utf-8')
  @SetMetadata('skip-api-response', true)
  getLandingPage(): Promise<string> {
    return this.appService.renderLandingPage();
  }
}
