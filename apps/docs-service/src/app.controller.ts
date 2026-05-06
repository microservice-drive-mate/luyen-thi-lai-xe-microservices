import { Controller, Get, Logger } from '@nestjs/common';
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
  async getDocsConfig(): Promise<SwaggerUiConfig> {
    let candidates = this.appService.buildCandidatesFromConfig();

    if (candidates.length === 0) {
      try {
        candidates = await this.appService.buildCandidatesFromCatalog();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Consul catalog unavailable: ${msg}`);
      }
    }

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

    return { urls, deepLinking: true };
  }
}
