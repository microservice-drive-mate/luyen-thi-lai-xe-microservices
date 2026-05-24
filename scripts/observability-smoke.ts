import axios from 'axios';

type Check = {
  name: string;
  url: string;
  validate?: (data: unknown) => string | undefined;
};

const timeoutMs = Number(process.env.OBS_SMOKE_TIMEOUT_MS ?? '5000');
const prometheusUrl = trimTrailingSlash(
  process.env.OBS_PROMETHEUS_URL ?? 'http://localhost:9090',
);
const alertmanagerUrl = trimTrailingSlash(
  process.env.OBS_ALERTMANAGER_URL ?? 'http://localhost:9093',
);
const grafanaUrl = trimTrailingSlash(
  process.env.OBS_GRAFANA_URL ?? 'http://localhost:30000',
);
const elasticsearchUrl = trimTrailingSlash(
  process.env.OBS_ELASTICSEARCH_URL ?? 'http://localhost:9200',
);
const kibanaUrl = trimTrailingSlash(
  process.env.OBS_KIBANA_URL ?? 'http://localhost:5601',
);
const serviceMetricsUrls = parseCsv(process.env.OBS_SERVICE_METRICS_URLS);

const checks: Check[] = [
  {
    name: 'prometheus-ready',
    url: `${prometheusUrl}/-/ready`,
  },
  {
    name: 'prometheus-rules',
    url: `${prometheusUrl}/api/v1/rules`,
    validate: (data) =>
      JSON.stringify(data).includes('ServiceMetricsEndpointDown')
        ? undefined
        : 'Missing ServiceMetricsEndpointDown rule',
  },
  {
    name: 'alertmanager-ready',
    url: `${alertmanagerUrl}/-/ready`,
  },
  {
    name: 'grafana-health',
    url: `${grafanaUrl}/api/health`,
    validate: (data) =>
      JSON.stringify(data).includes('ok') ? undefined : 'Grafana is not ok',
  },
  {
    name: 'elasticsearch-health',
    url: `${elasticsearchUrl}/_cluster/health`,
    validate: (data) =>
      JSON.stringify(data).includes('status')
        ? undefined
        : 'Missing Elasticsearch cluster status',
  },
  {
    name: 'kibana-status',
    url: `${kibanaUrl}/api/status`,
  },
  ...serviceMetricsUrls.map((url, index) => ({
    name: `service-metrics-${index + 1}`,
    url,
    validate: (data: unknown) =>
      String(data).includes('http_requests_total') ||
      String(data).includes('nodejs_process_cpu_seconds_total')
        ? undefined
        : 'Missing expected Prometheus metrics',
  })),
];

async function main(): Promise<void> {
  const failures: string[] = [];

  for (const check of checks) {
    try {
      const response = await axios.get(check.url, {
        timeout: timeoutMs,
        validateStatus: () => true,
      });

      if (response.status < 200 || response.status >= 300) {
        failures.push(`${check.name} ${check.url} -> HTTP ${response.status}`);
        continue;
      }

      const validationError = check.validate?.(response.data);
      if (validationError) {
        failures.push(`${check.name} ${check.url} -> ${validationError}`);
        continue;
      }

      console.log(`[observability-smoke] OK ${check.name}`);
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.message || error.code || 'Request failed'
        : error instanceof Error
          ? error.message
          : String(error);
      failures.push(`${check.name} ${check.url} -> ${message}`);
    }
  }

  if (failures.length > 0) {
    console.error('[observability-smoke] Failures detected:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('[observability-smoke] Observability stack checks passed.');
}

function parseCsv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

void main();
