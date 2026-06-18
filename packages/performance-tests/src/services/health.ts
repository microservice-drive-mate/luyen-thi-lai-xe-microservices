import { check, group, sleep } from 'k6';
import { BASE_URL, SERVICES, type ServiceConfig } from '../config';
import { http } from '../helpers/http';

export function checkLiveness(service: ServiceConfig): void {
  const res = http.get(`${BASE_URL}${service.healthLive}`, {
    tags: { name: `health_live_${service.name}` },
  });

  check(res, {
    [`${service.name} liveness 200`]: (r) => r.status === 200,
    [`${service.name} liveness <500ms`]: (r) => r.timings.duration < 500,
  });
}

export function checkReadiness(service: ServiceConfig): void {
  const res = http.get(`${BASE_URL}${service.healthReady}`, {
    tags: { name: `health_ready_${service.name}` },
  });

  check(res, {
    [`${service.name} readiness 200`]: (r) => r.status === 200,
    [`${service.name} readiness <500ms`]: (r) => r.timings.duration < 500,
  });
}

export function checkServiceHealth(service: ServiceConfig): void {
  group(`Health - ${service.name}`, () => {
    checkLiveness(service);
    sleep(0.1);
    checkReadiness(service);
  });
}

export function checkAllServicesHealth(): void {
  group('Health - All Services', () => {
    for (const service of SERVICES) {
      checkServiceHealth(service);
      sleep(0.2);
    }
  });
}

export function checkAllLiveness(): void {
  group('Liveness - All Services', () => {
    for (const service of SERVICES) {
      checkLiveness(service);
      sleep(0.1);
    }
  });
}
