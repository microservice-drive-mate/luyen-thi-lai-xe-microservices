import { Controller, Get, Logger, Query, SetMetadata } from '@nestjs/common';
import { AppService, ServiceCandidate } from './app.service';

interface SwaggerUiConfig {
  urls: ServiceCandidate[];
  deepLinking: boolean;
}

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  /**
   * Fetched by Swagger UI on every page load via `configUrl`.
   * Returns the current list of alive services so the dropdown
   * reflects reality without restarting docs-service.
   */
  @Get('docs-config')
  @SetMetadata('skip-api-response', true)
  async getDocsConfig(): Promise<SwaggerUiConfig> {
    const configuredCandidates = this.appService.buildCandidatesFromConfig();
    let catalogCandidates: ServiceCandidate[] = [];

    if (configuredCandidates.length === 0) {
      try {
        catalogCandidates = await this.appService.buildCandidatesFromCatalog();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Consul catalog unavailable: ${msg}`);
      }
    }

    const candidates = this.appService.mergeCandidates([
      ...configuredCandidates,
      ...catalogCandidates,
      ...this.appService.buildLocalFallbackCandidates(),
    ]);

    const urls = await this.appService.probeAlive(candidates);

    const dead = candidates
      .filter((c) => !urls.some((u) => u.url === c.url))
      .map((c) => c.name);

    if (dead.length > 0) {
      this.logger.debug(`Services not running (excluded): ${dead.join(', ')}`);
    }
    if (urls.length > 0) {
      this.logger.debug(
        `Active services: ${urls.map((u) => u.name).join(', ')}`,
      );
    }

    return {
      urls:
        urls.length > 0
          ? urls.map((u) => ({
              name: u.name,
              url: this.appService.buildProxyUrl(u.url),
            }))
          : [{ name: 'No services running', url: '/docs-json' }],
      deepLinking: true,
    };
  }

  @Get('docs-proxy')
  @SetMetadata('skip-api-response', true)
  async getDocsProxy(@Query('url') url: string): Promise<unknown> {
    return this.appService.fetchOpenApiDocument(url);
  }
}
