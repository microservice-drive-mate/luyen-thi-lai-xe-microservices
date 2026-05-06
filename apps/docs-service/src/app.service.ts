/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsulConfigService } from '@repo/common';

export interface ServiceCandidate {
  name: string;
  url: string;
}

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  buildCandidatesFromConfig(): ServiceCandidate[] {
    const raw = this.configService.get<string>('swagger.services');
    if (!raw) return [];

    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry) => {
        const [slug, svcPort = '3000'] = entry.split(':');
        return {
          name: slug
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase()),
          url: `http://localhost:${svcPort}/docs-json`,
        };
      });
  }

  async buildCandidatesFromCatalog(): Promise<ServiceCandidate[]> {
    const consulUrl = process.env.CONSUL_URL ?? 'http://localhost:8500';
    const gatewayUrl = process.env.GATEWAY_URL ?? 'http://localhost:8000';
    const consul = new ConsulConfigService(consulUrl);
    const services = await consul.getRegisteredServices();
    return services
      .filter((name) => name.endsWith('-service') && name !== 'docs-service')
      .map((name) => ({
        name: name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        url: `${gatewayUrl}/${name}/docs-json`,
      }));
  }

  async probeAlive(
    candidates: ServiceCandidate[],
  ): Promise<ServiceCandidate[]> {
    const results = await Promise.all(
      candidates.map(async (c) => ({ ...c, alive: await this.isAlive(c.url) })),
    );
    return results
      .filter((r) => r.alive)
      .map(({ alive: _alive, ...rest }) => rest);
  }

  private async isAlive(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  }
}
