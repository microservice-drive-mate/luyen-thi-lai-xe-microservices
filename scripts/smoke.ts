import axios from 'axios';

type RouteCheck = {
  name: string;
  basePath: string;
};

const gatewayUrl = process.env.SMOKE_GATEWAY_URL ?? 'http://localhost:8000';
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? '3000');

const checks: RouteCheck[] = [
  { name: 'identity-service', basePath: '/auth' },
  { name: 'user-service', basePath: '/users' },
  { name: 'exam-service', basePath: '/exams' },
  { name: 'course-service', basePath: '/courses' },
  { name: 'question-service', basePath: '/questions' },
  { name: 'notification-service', basePath: '/notifications' },
  { name: 'analytics-service', basePath: '/analytics' },
  { name: 'simulation-service', basePath: '/simulations' },
];

async function main(): Promise<void> {
  const failures: string[] = [];

  for (const check of checks) {
    for (const suffix of ['health/live', 'health/ready']) {
      const url = `${gatewayUrl}${check.basePath}/${suffix}`;

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
          failures.push(`${check.name} ${suffix} -> HTTP ${response.status}`);
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

void main();
