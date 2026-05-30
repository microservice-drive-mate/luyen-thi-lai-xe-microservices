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

    const nodeEnv =
      this.configService.get<string>('nodeEnv') ?? process.env.NODE_ENV;
    const urlMode =
      process.env.SWAGGER_SERVICE_URL_MODE ??
      (nodeEnv === 'development-local' ? 'localhost' : 'docker');

    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry) => {
        if (entry.startsWith('http://') || entry.startsWith('https://')) {
          const baseUrl = entry.replace(/\/+$/, '');
          return {
            name: new URL(baseUrl).hostname
              .replace(/-/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase()),
            url: `${baseUrl}/docs-json`,
          };
        }

        const [slug, svcPort = '3000'] = entry.split(':');
        const host = urlMode === 'localhost' ? 'localhost' : slug;
        return {
          name: slug
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase()),
          url: `http://${host}:${svcPort}/docs-json`,
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

  buildLocalFallbackCandidates(): ServiceCandidate[] {
    // Hardcoded local dev ports (from CLAUDE.md). probeAlive() filters dead ones.
    return [
      { name: 'Identity Service', url: 'http://localhost:3001/docs-json' },
      { name: 'User Service', url: 'http://localhost:3002/docs-json' },
      { name: 'Exam Service', url: 'http://localhost:3003/docs-json' },
      { name: 'Course Service', url: 'http://localhost:3004/docs-json' },
      { name: 'Question Service', url: 'http://localhost:3005/docs-json' },
      { name: 'Notification Service', url: 'http://localhost:3006/docs-json' },
      { name: 'Analytics Service', url: 'http://localhost:3007/docs-json' },
      { name: 'Simulation Service', url: 'http://localhost:3008/docs-json' },
      { name: 'Media Service', url: 'http://localhost:3010/docs-json' },
      { name: 'Audit Service', url: 'http://localhost:3011/docs-json' },
    ];
  }

  mergeCandidates(candidates: ServiceCandidate[]): ServiceCandidate[] {
    const seen = new Set<string>();
    return candidates.filter((candidate) => {
      if (seen.has(candidate.url)) {
        return false;
      }
      seen.add(candidate.url);
      return true;
    });
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

  buildProxyUrl(upstreamUrl: string): string {
    return `/docs-proxy?url=${encodeURIComponent(upstreamUrl)}`;
  }

  async fetchOpenApiDocument(upstreamUrl: string): Promise<unknown> {
    this.assertAllowedDocsUrl(upstreamUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(upstreamUrl, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(
          `Upstream Swagger spec returned ${res.status} ${res.statusText}`,
        );
      }
      const document = await res.json();
      return this.withUpstreamServer(document, upstreamUrl);
    } finally {
      clearTimeout(timer);
    }
  }

  private withUpstreamServer(document: unknown, upstreamUrl: string): unknown {
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
      return document;
    }

    const url = new URL(upstreamUrl);
    return {
      ...document,
      servers: [{ url: url.origin }],
    };
  }

  private assertAllowedDocsUrl(upstreamUrl: string): void {
    const url = new URL(upstreamUrl);
    const allowedHosts = new Set(['localhost', '127.0.0.1']);
    const allowedPorts = new Set([
      '3001',
      '3002',
      '3003',
      '3004',
      '3005',
      '3006',
      '3007',
      '3008',
      '3010',
      '3011',
    ]);

    if (
      url.protocol !== 'http:' ||
      !allowedHosts.has(url.hostname) ||
      !allowedPorts.has(url.port) ||
      url.pathname !== '/docs-json'
    ) {
      throw new Error(`Swagger upstream is not allowed: ${upstreamUrl}`);
    }
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
