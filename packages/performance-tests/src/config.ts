export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
export const DEFAULT_TIMEOUT = '30s';

export const JSON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

export function authHeaders(token: string): Record<string, string> {
  return {
    ...JSON_HEADERS,
    Authorization: `Bearer ${token}`,
  };
}

export const DEFAULT_THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.001'],
};

export const SMOKE_THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<800'],
  http_req_failed: ['rate<0.001'], // < 0.1% errors
};

export const LOAD_THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.001'],
};

export const SOAK_THRESHOLDS = {
  http_req_duration: ['p(95)<1000', 'p(99)<3000'],
  http_req_failed: ['rate<0.001'],
};

export const STRESS_THRESHOLDS = {
  http_req_duration: ['p(95)<2000', 'p(99)<5000'],
  http_req_failed: ['rate<0.05'],
};

export const SECURITY_THRESHOLDS = {
  http_req_duration: ['p(95)<2000'],
};

export interface ServiceConfig {
  name: string;
  route: string;
  healthLive: string;
  healthReady: string;
  optional?: boolean;
}

export const SERVICES: ServiceConfig[] = [
  {
    name: 'identity',
    route: '/auth',
    healthLive: '/identity-service/health/live',
    healthReady: '/identity-service/health/ready',
  },
  {
    name: 'user',
    route: '/users',
    healthLive: '/user-service/health/live',
    healthReady: '/user-service/health/ready',
  },
  {
    name: 'exam',
    route: '/exams/available',
    healthLive: '/exam-service/health/live',
    healthReady: '/exam-service/health/ready',
  },
  {
    name: 'course',
    route: '/courses',
    healthLive: '/course-service/health/live',
    healthReady: '/course-service/health/ready',
  },
  {
    name: 'question',
    route: '/admin/questions',
    healthLive: '/question-service/health/live',
    healthReady: '/question-service/health/ready',
  },
  {
    name: 'simulation',
    route: '/simulation',
    healthLive: '/simulation-service/health/live',
    healthReady: '/simulation-service/health/ready',
  },
  {
    name: 'notification',
    route: '/notifications',
    healthLive: '/notification-service/health/live',
    healthReady: '/notification-service/health/ready',
  },
  {
    name: 'analytics',
    route: '/analytics',
    healthLive: '/analytics-service/health/live',
    healthReady: '/analytics-service/health/ready',
  },
  {
    name: 'media',
    route: '/media',
    healthLive: '/media-service/health/live',
    healthReady: '/media-service/health/ready',
  },
  {
    name: 'audit',
    route: '/admin/audit-logs',
    healthLive: '/audit-service/health/live',
    healthReady: '/audit-service/health/ready',
  },
];

export const LicenseCategory = {
  A1: 'A1',
  A2: 'A2',
  B1: 'B1',
  B2: 'B2',
  C: 'C',
  D: 'D',
  E: 'E',
  F: 'F',
} as const;

export type LicenseCategory =
  (typeof LicenseCategory)[keyof typeof LicenseCategory];

export const ExamSessionStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
} as const;

export type ExamSessionStatus =
  (typeof ExamSessionStatus)[keyof typeof ExamSessionStatus];
