import { check, group, sleep } from 'k6';
import { authHeaders, BASE_URL } from '../config';
import { loginAsDefaultUser } from '../helpers/auth';
import { generateTelemetryEvent, randomLicenseCategory } from '../helpers/data';
import { http } from '../helpers/http';

export interface SimulationSession {
  id: string;
  status: string;
}

export function testStartSimulation(): string | null {
  let sessionId: string | null = null;

  const token = loginAsDefaultUser();
  if (!token) {
    console.warn('Skip simulation start: login failed');
    return sessionId;
  }

  group('Simulation - Start', () => {
    sleep(0.3);
    const payload = {
      licenseCategory: randomLicenseCategory(),
      mapId: __ENV.TEST_MAP_ID ?? 'map-default',
    };
    const res = http.post(
      `${BASE_URL}/simulation/sessions`,
      JSON.stringify(payload),
      { headers: authHeaders(token), tags: { name: 'simulation_start' } },
    );
    check(res, {
      'Simulation start: 200/201': (r) => r.status === 200 || r.status === 201,
      'Simulation start: <2s': (r) => r.timings.duration < 2000,
    });
    try {
      const body = JSON.parse(res.body as string);
      sessionId = body.id ?? body.sessionId ?? body.data?.id ?? null;
    } catch {
      sessionId = null;
    }
    sleep(0.5);
  });

  return sessionId;
}

export function testSendTelemetry(sessionId: string, eventCount = 10): void {
  const token = loginAsDefaultUser();
  if (!token) {
    console.warn('Skip telemetry: login failed');
    return;
  }

  group('Simulation - Telemetry Flood', () => {
    for (let i = 0; i < eventCount; i++) {
      const event = generateTelemetryEvent(sessionId);
      const res = http.post(
        `${BASE_URL}/simulation/sessions/${sessionId}/telemetry`,
        JSON.stringify(event),
        { headers: authHeaders(token), tags: { name: 'simulation_telemetry' } },
      );
      check(res, {
        'Telemetry: 200/204': (r) => r.status === 200 || r.status === 204,
        'Telemetry: <200ms': (r) => r.timings.duration < 200,
      });
      sleep(0.1);
    }
  });
}

export function testEndSimulation(sessionId: string): void {
  const token = loginAsDefaultUser();
  if (!token) {
    console.warn('Skip simulation end: login failed');
    return;
  }

  group('Simulation - End', () => {
    sleep(0.3);
    const res = http.post(
      `${BASE_URL}/simulation/sessions/${sessionId}/end`,
      null,
      { headers: authHeaders(token), tags: { name: 'simulation_end' } },
    );
    check(res, {
      'Simulation end: 200': (r) => r.status === 200,
      'Simulation end: <1s': (r) => r.timings.duration < 1000,
    });
    sleep(0.5);
  });
}

export function testGetSimulationResult(sessionId: string): void {
  const token = loginAsDefaultUser();
  if (!token) {
    console.warn('Skip simulation result: login failed');
    return;
  }

  group('Simulation - Get Result', () => {
    sleep(0.3);
    const res = http.get(`${BASE_URL}/simulation/sessions/${sessionId}`, {
      headers: authHeaders(token),
      tags: { name: 'simulation_result' },
    });
    check(res, {
      'Simulation result: 200/404': (r) => r.status === 200 || r.status === 404,
      'Simulation result: <500ms': (r) => r.timings.duration < 500,
    });
    sleep(0.3);
  });
}

export function testFullSimulationFlow(): void {
  const sessionId = testStartSimulation();
  if (!sessionId) return;

  group('Simulation - Full Flow (Heavy)', () => {
    for (let i = 0; i < 30; i++) {
      testSendTelemetry(sessionId, 10);
      sleep(1);
    }
  });

  testEndSimulation(sessionId);
  sleep(1);
  testGetSimulationResult(sessionId);
}
