import {
  Controller,
  Get,
  Header,
  Logger,
  Param,
  Query,
  SetMetadata,
} from '@nestjs/common';
import { AppService, DocsServiceOption, ServiceCandidate } from './app.service';

interface SwaggerUiConfig {
  urls: ServiceCandidate[];
  deepLinking: boolean;
}

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @Get('docs-config')
  @SetMetadata('skip-api-response', true)
  async getDocsConfig(): Promise<SwaggerUiConfig> {
    const urls = await this.appService.getAvailableServices();

    if (urls.length > 0) {
      this.logger.debug(
        `Active services: ${urls.map((service) => service.name).join(', ')}`,
      );
    }

    return {
      urls:
        urls.length > 0
          ? urls.map((service) => ({
              name: service.name,
              url: this.appService.buildProxyUrl(service.url),
            }))
          : [{ name: 'No services running', url: '/docs-json' }],
      deepLinking: true,
    };
  }

  @Get('docs-services')
  @SetMetadata('skip-api-response', true)
  getDocsServices(): Promise<DocsServiceOption[]> {
    return this.appService.getAvailableServiceOptions();
  }

  @Get('docs-json')
  @SetMetadata('skip-api-response', true)
  getDocsJson(): unknown {
    return this.appService.buildPlaceholderDocument();
  }

  @Get('docs-proxy')
  @SetMetadata('skip-api-response', true)
  async getDocsProxy(
    @Query('url') url?: string,
    @Query('service') service?: string,
  ): Promise<unknown> {
    return this.appService.fetchOpenApiDocument({ service, url });
  }

  @Get('docs/scalar/:serviceName')
  @Header('content-type', 'text/html; charset=utf-8')
  @SetMetadata('skip-api-response', true)
  async getScalarService(
    @Param('serviceName') serviceName: string,
  ): Promise<string> {
    return this.appService.renderScalarPage(serviceName);
  }
}
