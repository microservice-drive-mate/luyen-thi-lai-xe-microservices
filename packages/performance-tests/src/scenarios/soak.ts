import { sleep } from 'k6';
import type { Options } from 'k6/options';
import { SOAK_THRESHOLDS } from '../config';
import { testLogin, testGetProfile } from '../services/identity';
import {
  testListExams,
  testGetExamDetail,
  testStartExam,
  testSubmitExam,
} from '../services/exam';
import { testListCourses, testListEnrollments } from '../services/course';
import { testGetUserProfile } from '../services/user';
import { testListQuestions } from '../services/question';
import { setupKeycloak } from '../helpers/setup';

export function setup(): void {
  setupKeycloak();
}
const soakDuration = __ENV.SOAK_DURATION || '2h';

export const options: Options = {
  stages: [
    { duration: '10m', target: 30 },
    { duration: soakDuration, target: 30 },
    { duration: '10m', target: 0 },
  ],
  thresholds: {
    ...SOAK_THRESHOLDS,
    'http_req_duration{name:identity_login}': ['p(95)<1000'],
    'http_req_duration{name:exam_list}': ['p(95)<800'],
    'http_req_duration{name:exam_submit}': ['p(95)<3000'],
    'http_req_duration{name:question_list}': ['p(95)<800'],
  },
  tags: { test_type: 'soak', scenario: __ENV.K6_SCENARIO || 'soak' },
};

export default function (): void {
  testLogin();
  sleep(1 + Math.random());

  testGetProfile();
  sleep(0.5);

  testGetUserProfile();
  sleep(0.5);

  testListExams();
  sleep(1 + Math.random());

  testListCourses();
  sleep(1 + Math.random());

  testListQuestions();
  sleep(0.5);

  if (Math.random() < 0.25) {
    testGetExamDetail();
    sleep(0.5);
  }

  if (Math.random() < 0.2) {
    testListEnrollments();
    sleep(0.5);
  }

  if (Math.random() < 0.1) {
    const sessionId = testStartExam();
    if (sessionId) {
      sleep(3 + Math.random() * 2);
      testSubmitExam(sessionId);
    }
    sleep(1);
  }

  sleep(2 + Math.random() * 3);
}
