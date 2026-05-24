import axios from 'axios';

type RouteCheck = {
  name: string;
  routePrefix: string;
};

const gatewayUrl = process.env.SMOKE_GATEWAY_URL ?? 'http://localhost:8000';
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? '3000');
const delayMs = Number(process.env.SMOKE_DELAY_MS ?? '300');

const checks: RouteCheck[] = [
  { name: 'identity-service', routePrefix: '/identity-service' },
  { name: 'user-service', routePrefix: '/user-service' },
  { name: 'exam-service', routePrefix: '/exam-service' },
  { name: 'course-service', routePrefix: '/course-service' },
  { name: 'question-service', routePrefix: '/question-service' },
  { name: 'notification-service', routePrefix: '/notification-service' },
  { name: 'analytics-service', routePrefix: '/analytics-service' },
  { name: 'simulation-service', routePrefix: '/simulation-service' },
  { name: 'media-service', routePrefix: '/media-service' },
  { name: 'audit-service', routePrefix: '/audit-service' },
];

async function main(): Promise<void> {
  const failures: string[] = [];

  for (const check of checks) {
    for (const suffix of ['health/live', 'health/ready']) {
      const url = `${gatewayUrl}${check.routePrefix}/${suffix}`;

      try {
        const response = await axios.get(url, {
          timeout: timeoutMs,
          validateStatus: () => true,
        });

        const ok = response.status >= 200 && response.status < 300;
        const success =
          typeof response.data === 'object' &&
          response.data !== null &&
          'success' in (response.data as Record<string, unknown>)
            ? Boolean((response.data as Record<string, unknown>).success)
            : true;

        if (!ok || !success) {
          failures.push(`${check.name} ${url} -> HTTP ${response.status}`);
          continue;
        }

        console.log(`[smoke] OK ${check.name} ${suffix}`);
      } catch (error) {
        const message = axios.isAxiosError(error)
          ? error.message || error.code || 'Request failed'
          : error instanceof Error
            ? error.message
            : String(error);
        failures.push(`${check.name} ${suffix} -> ${message}`);
      }

      await sleep(delayMs);
    }
  }

  if (failures.length > 0) {
    console.error('[smoke] Failures detected:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('[smoke] All health checks passed.');
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
}

void main();
