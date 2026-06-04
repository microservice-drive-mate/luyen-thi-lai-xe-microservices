import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsulConfigService } from '@repo/common';

export interface ServiceCandidate {
  name: string;
  url: string;
}

export interface DocsServiceOption extends ServiceCandidate {
  proxiedUrl: string;
  slug: string;
}

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  async getAvailableServices(): Promise<ServiceCandidate[]> {
    const candidates = await this.buildCandidateList();
    return this.probeAlive(candidates);
  }

  async getAvailableServiceOptions(): Promise<DocsServiceOption[]> {
    const services = await this.getAvailableServices();
    return services.map((service) => this.toDocsServiceOption(service));
  }

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
      .map((service) => service.trim())
      .filter(Boolean)
      .map((entry) => {
        if (entry.startsWith('http://') || entry.startsWith('https://')) {
          const baseUrl = entry.replace(/\/+$/, '');
          return {
            name: new URL(baseUrl).hostname
              .replace(/-/g, ' ')
              .replace(/\b\w/g, (char) => char.toUpperCase()),
            url: `${baseUrl}/docs-json`,
          };
        }

        const [slug, servicePort = '3000'] = entry.split(':');
        const host = urlMode === 'localhost' ? 'localhost' : slug;
        return {
          name: slug
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase()),
          url: `http://${host}:${servicePort}/docs-json`,
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
        name: name
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase()),
        url: `${gatewayUrl}/${name}/docs-json`,
      }));
  }

  buildLocalFallbackCandidates(): ServiceCandidate[] {
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
      candidates.map(async (candidate) => ({
        ...candidate,
        alive: await this.isAlive(candidate.url),
      })),
    );
    return results
      .filter((result) => result.alive)
      .map(({ name, url }) => ({ name, url }));
  }

  buildProxyUrl(upstreamUrl: string): string {
    return `/docs-proxy?url=${encodeURIComponent(upstreamUrl)}`;
  }

  async fetchOpenApiDocument(options: {
    service?: string;
    url?: string;
  }): Promise<unknown> {
    const upstreamUrl = await this.resolveOpenApiUrl(options);
    if (!upstreamUrl) {
      return this.buildPlaceholderDocument();
    }

    await this.assertAllowedDocsUrl(upstreamUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(upstreamUrl, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(
          `Upstream OpenAPI spec returned ${response.status} ${response.statusText}`,
        );
      }
      const document = await response.json();
      return this.withUpstreamServer(document, upstreamUrl);
    } finally {
      clearTimeout(timer);
    }
  }

  buildPlaceholderDocument(): unknown {
    return {
      openapi: '3.0.0',
      info: {
        title: 'Centralized API Documentation',
        version: '1.0.0',
      },
      paths: {},
    };
  }

  async renderLandingPage(): Promise<string> {
    const services = await this.getAvailableServiceOptions();
    const serviceLinks =
      services.length > 0
        ? services
            .map(
              (service) => `
                <a class="service" href="/docs/scalar/${service.slug}">
                  <span>${this.escapeHtml(service.name)}</span>
                  <small>${this.escapeHtml(service.url)}</small>
                </a>`,
            )
            .join('')
        : '<p class="empty">No API services are currently reachable.</p>';

    return this.renderShell(
      'Luyen Thi Lai Xe API Docs',
      `
        <main class="landing">
          <section class="intro">
            <p class="eyebrow">API Documentation</p>
            <h1>Luyen Thi Lai Xe Microservices</h1>
            <p class="copy">Choose a running service to open its Scalar API reference.</p>
            <a class="primary" href="/docs">Open Default Reference</a>
          </section>
          <section class="services">${serviceLinks}</section>
        </main>`,
    );
  }

  async renderScalarPage(serviceName: string): Promise<string> {
    const services = await this.getAvailableServiceOptions();
    const selected =
      services.find((service) => service.slug === serviceName) ??
      services.find(
        (service) =>
          service.name.toLowerCase() ===
          serviceName.replace(/-/g, ' ').toLowerCase(),
      ) ??
      services[0];
    const specUrl = selected
      ? `/docs-proxy?service=${encodeURIComponent(selected.slug)}`
      : '/docs-proxy';
    const title = selected?.name ?? 'API Reference';

    return this.renderShell(
      `${title} API Reference`,
      `
        <style>
          #custom-header {
            position: sticky;
            top: 0;
            height: 48px;
            background: #0f172a;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 20px;
            font-family: Inter, sans-serif;
            color: #fff;
            z-index: 100000;
          }
        </style>
        <div id="custom-header">
          <a href="/" style="color: #fff; text-decoration: none; font-weight: 600; font-size: 14px;">← API Portal</a>
          <div style="display: flex; align-items: center; gap: 12px;">
            <label for="service-selector" style="font-size: 13px; color: #94a3b8;">Service:</label>
            <select id="service-selector" style="padding: 6px 32px 6px 12px; border-radius: 6px; border: 1px solid #334155; background: #1e293b; color: #f8fafc; font-size: 13px; cursor: pointer; outline: none; appearance: none; background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M6%208.825L1.175%204%202.238%202.938%206%206.7l3.763-3.762L10.825%204z%22%2F%3E%3C%2Fsvg%3E'); background-repeat: no-repeat; background-position: right 10px center; min-width: 200px;">
               <option value="">Loading services...</option>
            </select>
          </div>
        </div>
        <div id="app"></div>
        <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
        <script>
          fetch('/docs-services')
            .then(res => res.json())
            .then(services => {
              const selector = document.getElementById('service-selector');
              selector.innerHTML = '';
              const currentService = '${this.escapeScript(selected?.slug ?? serviceName)}';
              services.forEach(svc => {
                const option = document.createElement('option');
                option.value = svc.slug;
                option.textContent = svc.name;
                if (svc.slug === currentService) {
                  option.selected = true;
                }
                selector.appendChild(option);
              });

              selector.addEventListener('change', (e) => {
                const selectedService = e.target.value;
                if (selectedService) {
                  window.location.href = '/docs/scalar/' + selectedService;
                }
              });
            })
            .catch(err => {
              console.error('Failed to load services:', err);
              document.getElementById('service-selector-container').style.display = 'none';
            });

          Scalar.createApiReference('#app', {
            url: '${specUrl}',
            theme: 'purple',
            pageTitle: '${this.escapeScript(title)} API Reference',
            persistAuth: true,
            showDeveloperTools: 'localhost'
          });
        </script>`,
      true,
    );
  }

  private async buildCandidateList(): Promise<ServiceCandidate[]> {
    const configuredCandidates = this.buildCandidatesFromConfig();
    let catalogCandidates: ServiceCandidate[] = [];

    if (configuredCandidates.length === 0) {
      try {
        catalogCandidates = await this.buildCandidatesFromCatalog();
      } catch {
        catalogCandidates = [];
      }
    }

    return this.mergeCandidates([
      ...configuredCandidates,
      ...catalogCandidates,
      ...this.buildLocalFallbackCandidates(),
    ]);
  }

  private async resolveOpenApiUrl(options: {
    service?: string;
    url?: string;
  }): Promise<string | null> {
    if (options.url) {
      return options.url;
    }

    const services = await this.getAvailableServices();
    if (options.service) {
      const requested = options.service.toLowerCase();
      const match = services.find((service) => {
        const slug = this.slugify(service.name);
        return slug === requested || service.name.toLowerCase() === requested;
      });
      return match?.url ?? null;
    }

    return services[0]?.url ?? null;
  }

  private toDocsServiceOption(service: ServiceCandidate): DocsServiceOption {
    return {
      ...service,
      proxiedUrl: this.buildProxyUrl(service.url),
      slug: this.slugify(service.name),
    };
  }

  private async assertAllowedDocsUrl(upstreamUrl: string): Promise<void> {
    const candidates = await this.buildCandidateList();
    const allowedUrls = new Set(candidates.map((candidate) => candidate.url));
    if (allowedUrls.has(upstreamUrl)) {
      return;
    }

    throw new Error(`OpenAPI upstream is not allowed: ${upstreamUrl}`);
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

  private async isAlive(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      return response.ok;
    } catch {
      return false;
    }
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private renderShell(title: string, body: string, fullBleed = false): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${this.escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f7f8fa;
      color: #1c2024;
    }
    body {
      margin: 0;
      min-height: 100vh;
      background: #f7f8fa;
    }
    .landing {
      min-height: 100vh;
      display: grid;
      grid-template-columns: minmax(280px, 0.85fr) minmax(320px, 1.15fr);
    }
    .intro {
      padding: 72px 56px;
      background: #1f2937;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .eyebrow {
      margin: 0 0 16px;
      font-size: 13px;
      letter-spacing: 0;
      text-transform: uppercase;
      color: #a7f3d0;
    }
    h1 {
      margin: 0;
      font-size: 42px;
      line-height: 1.1;
      letter-spacing: 0;
    }
    .copy {
      max-width: 520px;
      margin: 20px 0 32px;
      color: #d1d5db;
      line-height: 1.6;
      font-size: 16px;
    }
    .primary {
      width: fit-content;
      min-height: 40px;
      padding: 0 16px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      background: #10b981;
      color: #052e1f;
      font-weight: 700;
      text-decoration: none;
    }
    .services {
      padding: 56px;
      display: grid;
      align-content: center;
      gap: 12px;
    }
    .service {
      border: 1px solid #d8dee6;
      border-radius: 8px;
      padding: 16px;
      background: #ffffff;
      color: inherit;
      text-decoration: none;
      display: grid;
      gap: 6px;
    }
    .service:hover {
      border-color: #10b981;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
    }
    .service span {
      font-weight: 700;
    }
    .service small,
    .empty {
      color: #667085;
      overflow-wrap: anywhere;
    }
    #app {
      min-height: 100vh;
    }
    @media (max-width: 800px) {
      .landing {
        grid-template-columns: 1fr;
      }
      .intro,
      .services {
        padding: 32px 20px;
      }
      h1 {
        font-size: 34px;
      }
    }
  </style>
</head>
<body class="${fullBleed ? 'scalar-page' : ''}">
${body}
</body>
</html>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private escapeScript(value: string): string {
    return this.escapeHtml(value).replace(/\\/g, '\\\\');
  }
}
