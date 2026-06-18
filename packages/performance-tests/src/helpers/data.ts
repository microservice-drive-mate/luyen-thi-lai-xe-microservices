import type { LicenseCategory } from '../config';

export function randomString(
  length = 10,
  chars = 'abcdefghijklmnopqrstuvwxyz0123456789',
): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomItem<T>(arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('randomItem: empty array');
  // biome-ignore lint/style/noNonNullAssertion: safe non-null assertion as array length is checked
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function randomEmail(): string {
  return `k6_${Date.now()}_${randomString(6)}@loadtest.internal`;
}

export function randomVietnameseName(): string {
  const ho = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Phan', 'Vũ', 'Đặng'];
  const ten = [
    'An',
    'Bình',
    'Cường',
    'Dũng',
    'Hải',
    'Hưng',
    'Lan',
    'Mai',
    'Nam',
    'Tuấn',
  ];
  return `${randomItem(ho)} ${randomItem(ten)}`;
}

export function randomPhoneNumber(): string {
  const prefixes = [
    '090',
    '091',
    '093',
    '097',
    '032',
    '033',
    '038',
    '070',
    '079',
  ];
  return randomItem(prefixes) + randomString(7, '0123456789');
}

export function randomPagination(): { page: number; limit: number } {
  const limits = [10, 20] as const;
  return { page: randomInt(1, 3), limit: randomItem(limits) };
}

export interface RegistrationData {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
}

export function generateRegistrationData(): RegistrationData {
  return {
    email: randomEmail(),
    password: 'Test@123456',
    fullName: randomVietnameseName(),
    phoneNumber: randomPhoneNumber(),
  };
}

export interface ExamSubmissionAnswer {
  questionId: string;
  selectedOptionId: string;
}

export interface ExamSubmission {
  answers: ExamSubmissionAnswer[];
}

export function generateExamSubmission(
  questionIds: string[] = [],
  totalQuestions = 30,
): ExamSubmission {
  const count = questionIds.length > 0 ? questionIds.length : totalQuestions;
  const answers: ExamSubmissionAnswer[] = [];
  for (let i = 0; i < count; i++) {
    answers.push({
      questionId: questionIds[i] ?? `question_${i + 1}`,
      selectedOptionId: `option_${randomInt(0, 3)}`,
    });
  }
  return { answers };
}

export function generateEnrollmentData(courseId: string): { courseId: string } {
  return { courseId };
}

export interface SimulationTelemetryEvent {
  sessionId: string;
  timestamp: string;
  positionX: number;
  positionY: number;
  speed: number;
  heading: number;
  isPenalty: boolean;
  penaltyReason?: string;
}

export function generateTelemetryEvent(
  sessionId: string,
): SimulationTelemetryEvent {
  const isPenalty = Math.random() < 0.05;
  return {
    sessionId,
    timestamp: new Date().toISOString(),
    positionX: Math.random() * 100,
    positionY: Math.random() * 100,
    speed: randomInt(0, 60),
    heading: randomInt(0, 360),
    isPenalty,
    penaltyReason: isPenalty
      ? randomItem(['out_of_lane', 'hit_cone', 'speeding'])
      : undefined,
  };
}

const LICENSE_CATEGORIES: LicenseCategory[] = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C',
  'D',
  'E',
  'F',
];

export function randomLicenseCategory(): LicenseCategory {
  return randomItem(LICENSE_CATEGORIES);
}
