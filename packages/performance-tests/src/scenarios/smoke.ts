import { sleep } from 'k6';
import type { Options } from 'k6/options';
import { SERVICES, SMOKE_THRESHOLDS } from '../config';
import { testListCourses } from '../services/course';
import { testListExams } from '../services/exam';
import { checkLiveness } from '../services/health';
import { testGetProfile, testLogin } from '../services/identity';

export const options: Options = {
  vus: 3,
  duration: '30s',
  thresholds: {
    ...SMOKE_THRESHOLDS,
    'http_req_duration{name:identity_login}': ['p(95)<500'],
    'http_req_duration{name:exam_list}': ['p(95)<800'],
    'http_req_duration{name:course_list}': ['p(95)<800'],
    'http_req_failed{name:identity_login}': ['rate<0.05'],
  },
  tags: { test_type: 'smoke', scenario: __ENV.K6_SCENARIO || 'smoke' },
};

export default function (): void {
  for (const service of SERVICES) {
    checkLiveness(service);
  }
  sleep(0.5);

  testLogin();
  sleep(0.5);

  testGetProfile();
  sleep(0.5);

  testListExams();
  sleep(0.5);

  testListCourses();
  sleep(1);
}
