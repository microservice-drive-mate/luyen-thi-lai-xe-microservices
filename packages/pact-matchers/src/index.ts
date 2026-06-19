import {
  boolean,
  eachLike,
  integer,
  like,
  matchStatus,
  nullValue,
  regex,
  string,
  timestamp,
  uuid,
} from '@pact-foundation/pact/src/v3/matchers';

const ISO_TIMESTAMP_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSSX";

const examples = {
  adminId: '550e8400-e29b-41d4-a716-446655440100',
  optionId: '550e8400-e29b-41d4-a716-446655440301',
  questionId: '550e8400-e29b-41d4-a716-446655440300',
  sessionId: '550e8400-e29b-41d4-a716-446655440200',
  templateId: '550e8400-e29b-41d4-a716-446655440000',
  timestamp: '2026-06-01T00:00:00.000Z',
  topicId: '550e8400-e29b-41d4-a716-446655440400',
  userId: '550e8400-e29b-41d4-a716-446655440010',
};

export const pactExamples = examples;

export const userRoleMatcher = (example = 'STUDENT') =>
  regex('ADMIN|CENTER_MANAGER|INSTRUCTOR|STUDENT', example);

export const licenseCategoryMatcher = (example = 'B1') =>
  regex('A1|A2|B1|B2|C|D|E|F', example);

export const examSessionStatusMatcher = (example = 'IN_PROGRESS') =>
  regex('IN_PROGRESS|COMPLETED|TIMED_OUT|CANCELLED', example);

export const isoTimestampMatcher = (example = examples.timestamp) =>
  timestamp(ISO_TIMESTAMP_FORMAT, example);

export const successStatusMatcher = (example = 200) =>
  matchStatus(example, [200, 201]);

export const successEnvelopeMatcher = (data: unknown, message = 'OK') => ({
  success: true,
  code: 'SUCCESS',
  message: like(message),
  timestamp: isoTimestampMatcher(),
  path: string('/contract-test'),
  data,
});

export const errorEnvelopeMatcher = (code = 'VALIDATION_ERROR') => ({
  success: false,
  code: string(code),
  message: string('Validation failed'),
  timestamp: isoTimestampMatcher(),
  path: string('/contract-test'),
});

export const loginResponseMatcher = () => ({
  accessToken: string('access-token'),
  refreshToken: string('refresh-token'),
  expiresIn: integer(300),
  refreshExpiresIn: integer(1800),
  tokenType: regex('Bearer|bearer', 'Bearer'),
  scope: string('openid profile email'),
});

export const logoutResponseMatcher = () => ({
  success: true,
  message: string('You have been logged out successfully.'),
  instruction: string('Please delete your token from LocalStorage or Cookie'),
});

export const passwordActionResponseMatcher = () => ({
  success: true,
  message: string('Password action completed successfully.'),
});

export const createIdentityUserResponseMatcher = () => ({
  userId: uuid(examples.userId),
  email: string('student@example.com'),
  fullName: string('Nguyen Van A'),
  role: userRoleMatcher(),
});

export const identityUserMatcher = () => ({
  userId: uuid(examples.userId),
  email: string('student@example.com'),
  fullName: string('Nguyen Van A'),
  role: userRoleMatcher(),
  isActive: boolean(true),
  isDeleted: boolean(false),
  deletedAt: nullValue(),
  createdAt: isoTimestampMatcher(),
  updatedAt: isoTimestampMatcher(),
});

export const deletedIdentityUserMatcher = () => ({
  ...identityUserMatcher(),
  isActive: boolean(false),
  isDeleted: boolean(true),
  deletedAt: isoTimestampMatcher(),
});

export const paginatedIdentityUsersMatcher = () => ({
  items: eachLike(identityUserMatcher(), 1),
  total: integer(1),
  page: integer(1),
  size: integer(20),
});

export const changeRoleResponseMatcher = () => ({
  userId: uuid(examples.userId),
  role: userRoleMatcher('INSTRUCTOR'),
});

export const lockUserResponseMatcher = () => ({
  userId: uuid(examples.userId),
  locked: boolean(true),
});

export const availableExamMatcher = () => ({
  id: uuid(examples.templateId),
  name: string('De thi B1'),
  description: nullValue(),
  licenseCategory: licenseCategoryMatcher('B1'),
  totalQuestions: integer(30),
  passingScore: integer(26),
  durationMinutes: integer(20),
  criticalQuestions: integer(1),
  maxCriticalMistakes: integer(0),
  shuffleQuestions: boolean(true),
});

export const paginatedAvailableExamsMatcher = () => ({
  items: eachLike(availableExamMatcher(), 1),
  total: integer(1),
  page: integer(1),
  size: integer(20),
});

export const topicDistributionItemMatcher = () => ({
  topicId: uuid(examples.topicId),
  questionCount: integer(30),
});

export const examTemplateMatcher = () => ({
  id: uuid(examples.templateId),
  name: string('De thi B1'),
  description: nullValue(),
  licenseCategory: licenseCategoryMatcher('B1'),
  totalQuestions: integer(30),
  passingScore: integer(26),
  durationMinutes: integer(20),
  criticalQuestions: integer(1),
  maxCriticalMistakes: integer(0),
  shuffleQuestions: boolean(true),
  topicDistribution: eachLike(topicDistributionItemMatcher(), 1),
  isActive: boolean(true),
  isDeleted: boolean(false),
  version: integer(1),
  createdById: uuid(examples.adminId),
  createdAt: isoTimestampMatcher(),
  updatedAt: isoTimestampMatcher(),
});

export const paginatedExamTemplatesMatcher = () => ({
  items: eachLike(examTemplateMatcher(), 1),
  total: integer(1),
  page: integer(1),
  size: integer(20),
});

export const examQuestionOptionMatcher = () => ({
  id: uuid(examples.optionId),
  content: string('Dap an A'),
  displayOrder: integer(1),
});

export const examSessionQuestionMatcher = () => ({
  questionId: uuid(examples.questionId),
  content: string('Noi dung cau hoi'),
  imageUrl: nullValue(),
  mediaFileId: nullValue(),
  options: eachLike(examQuestionOptionMatcher(), 1),
  displayOrder: integer(1),
  isBookmarked: boolean(false),
  selectedOptionId: nullValue(),
});

export const examResultQuestionMatcher = () => ({
  ...examSessionQuestionMatcher(),
  selectedOptionId: uuid(examples.optionId),
  isCorrect: boolean(true),
});

export const examSessionMatcher = () => ({
  id: uuid(examples.sessionId),
  studentId: uuid(examples.userId),
  templateId: uuid(examples.templateId),
  licenseCategory: licenseCategoryMatcher('B1'),
  status: examSessionStatusMatcher('IN_PROGRESS'),
  score: nullValue(),
  isPassed: nullValue(),
  failedByCritical: boolean(false),
  criticalMistakes: integer(0),
  maxCriticalMistakes: integer(0),
  startedAt: isoTimestampMatcher(),
  finishedAt: nullValue(),
  expiresAt: isoTimestampMatcher('2026-06-01T00:20:00.000Z'),
  questions: eachLike(examSessionQuestionMatcher(), 1),
});

export const answeredExamSessionQuestionMatcher = () => ({
  ...examSessionQuestionMatcher(),
  isBookmarked: boolean(true),
  selectedOptionId: uuid(examples.optionId),
});

export const answeredExamSessionMatcher = () => ({
  ...examSessionMatcher(),
  questions: eachLike(answeredExamSessionQuestionMatcher(), 1),
});

export const examResultMatcher = () => ({
  ...examSessionMatcher(),
  status: examSessionStatusMatcher('COMPLETED'),
  score: integer(28),
  isPassed: boolean(true),
  finishedAt: isoTimestampMatcher('2026-06-01T00:15:00.000Z'),
  questions: eachLike(examResultQuestionMatcher(), 1),
});

export const paginatedExamSessionsMatcher = () => ({
  items: eachLike(examSessionMatcher(), 1),
  total: integer(1),
  page: integer(1),
  size: integer(20),
});

export const examSessionQuestionsMatcher = () => ({
  items: eachLike(examSessionQuestionMatcher(), 1),
});

export const missedQuestionMatcher = () => ({
  questionId: uuid(examples.questionId),
  content: string('Noi dung cau hoi'),
  imageUrl: nullValue(),
  mediaFileId: nullValue(),
  options: eachLike(examQuestionOptionMatcher(), 1),
  lastAnsweredAt: isoTimestampMatcher('2026-06-01T00:10:00.000Z'),
  missedCount: integer(3),
});

export const missedQuestionsResponseMatcher = () => ({
  items: eachLike(missedQuestionMatcher(), 1),
});
