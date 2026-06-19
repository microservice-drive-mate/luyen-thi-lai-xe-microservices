import { extractPayload } from '@pact-foundation/pact/src/v3/matchers';
import {
  deletedIdentityUserMatcher,
  examResultMatcher,
  identityUserMatcher,
  loginResponseMatcher,
  missedQuestionsResponseMatcher,
  paginatedAvailableExamsMatcher,
  successEnvelopeMatcher,
} from '../src';

describe('@repo/pact-matchers', () => {
  it('builds a shared response envelope with stable contract fields', () => {
    const payload = extractPayload(
      successEnvelopeMatcher(loginResponseMatcher()),
    ) as {
      success: boolean;
      code: string;
      data: { accessToken: string; tokenType: string };
    };

    expect(payload).toMatchObject({
      success: true,
      code: 'SUCCESS',
      data: {
        accessToken: 'access-token',
        tokenType: 'Bearer',
      },
    });
  });

  it('keeps identity user fields aligned with identity-service DTOs', () => {
    const payload = extractPayload(identityUserMatcher()) as Record<
      string,
      unknown
    >;

    expect(Object.keys(payload).sort()).toEqual([
      'createdAt',
      'deletedAt',
      'email',
      'fullName',
      'isActive',
      'isDeleted',
      'role',
      'updatedAt',
      'userId',
    ]);
  });

  it('models soft-deleted identity users with a deletion timestamp', () => {
    const payload = extractPayload(deletedIdentityUserMatcher()) as {
      isActive: boolean;
      isDeleted: boolean;
      deletedAt: string | null;
    };

    expect(payload).toMatchObject({
      isActive: false,
      isDeleted: true,
      deletedAt: '2026-06-01T00:00:00.000Z',
    });
  });

  it('keeps exam session result fields aligned with exam-service DTOs', () => {
    const payload = extractPayload(examResultMatcher()) as {
      status: string;
      score: number;
      isPassed: boolean;
      questions: Array<{ isCorrect: boolean }>;
    };

    expect(payload).toMatchObject({
      status: 'COMPLETED',
      score: 28,
      isPassed: true,
    });
    expect(payload.questions[0]).toHaveProperty('isCorrect', true);
  });

  it('provides paginated exam list matchers for mobile consumers', () => {
    const payload = extractPayload(paginatedAvailableExamsMatcher()) as {
      items: Array<{
        licenseCategory: string;
        totalQuestions: number;
        passingScore: number;
      }>;
    };

    expect(payload.items[0]).toMatchObject({
      licenseCategory: 'B1',
      totalQuestions: 30,
      passingScore: 26,
    });
  });

  it('keeps missed-review payload aligned with exam-service response DTO', () => {
    const payload = extractPayload(missedQuestionsResponseMatcher()) as {
      items: Array<{
        questionId: string;
        options: Array<{ displayOrder: number }>;
        missedCount: number;
      }>;
    };

    expect(payload.items[0]).toMatchObject({
      questionId: '550e8400-e29b-41d4-a716-446655440300',
      missedCount: 3,
    });
    expect(payload.items[0].options[0]).toHaveProperty('displayOrder', 1);
  });
});
