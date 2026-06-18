import { sleep } from 'k6';
import type { Options } from 'k6/options';
import { LOAD_THRESHOLDS } from '../config';
import { setupKeycloak } from '../helpers/setup';
import {
  testEnrollCourse,
  testGetCourseDetail,
  testListCourses,
  testListEnrollments,
} from '../services/course';
import {
  testGetExamDetail,
  testListExams,
  testStartExam,
  testSubmitExam,
} from '../services/exam';
import { checkAllServicesHealth } from '../services/health';
import {
  testGetProfile,
  testLogin,
  testLoginFailure,
} from '../services/identity';
import {
  testEndSimulation,
  testSendTelemetry,
  testStartSimulation,
} from '../services/simulation';
import { testGetUserProfile } from '../services/user';

export function setup(): void {
  setupKeycloak();
}
export const options: Options = {
  stages: [
    { duration: '3m', target: 20 },
    { duration: '2m', target: 50 },
    { duration: '10m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    ...LOAD_THRESHOLDS,
    'http_req_duration{name:identity_login}': ['p(95)<800'],
    'http_req_duration{name:exam_list}': ['p(95)<600'],
    'http_req_duration{name:exam_start}': ['p(95)<1500'],
    'http_req_duration{name:exam_submit}': ['p(95)<2000'],
    'http_req_duration{name:simulation_telemetry}': ['p(95)<300'],
    'http_req_duration{name:course_list}': ['p(95)<600'],
    'http_req_duration{name:course_enroll}': ['p(95)<1500'],
    'http_req_duration{name:user_profile}': ['p(95)<500'],
  },
  tags: { test_type: 'load', scenario: __ENV.K6_SCENARIO || 'load' },
};

export default function (): void {
  if (Math.random() < 0.05) {
    checkAllServicesHealth();
    sleep(1);
  }

  if (Math.random() < 0.1) {
    testLogin();
    sleep(0.5 + Math.random());
  }

  testGetProfile();
  sleep(0.3 + Math.random() * 0.5);

  testGetUserProfile();
  sleep(0.5);

  testListExams();
  sleep(0.5 + Math.random());

  testListCourses();
  sleep(0.5 + Math.random());

  if (Math.random() < 0.6) {
    testGetExamDetail();
    sleep(0.5);
  }

  if (Math.random() < 0.6) {
    testGetCourseDetail();
    sleep(0.5);
  }

  if (Math.random() < 0.3) {
    testEnrollCourse();
    sleep(0.5);
  }

  if (Math.random() < 0.3) {
    testListEnrollments();
    sleep(0.5);
  }

  if (Math.random() < 0.2) {
    const sessionId = testStartExam();
    if (sessionId) {
      sleep(2 + Math.random() * 2);
      testSubmitExam(sessionId);
    }
    sleep(0.5);
  }

  if (Math.random() < 0.08) {
    const simulationSessionId = testStartSimulation();
    if (simulationSessionId) {
      testSendTelemetry(simulationSessionId, 3);
      testEndSimulation(simulationSessionId);
    }
    sleep(0.5);
  }

  if (Math.random() < 0.05) {
    testLoginFailure();
    sleep(0.3);
  }

  sleep(1 + Math.random() * 2);
}
