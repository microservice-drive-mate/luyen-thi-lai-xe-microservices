import { StudentLearningProgress } from './learning-progress.aggregate';

const baseProfile = {
  id: 'student-1',
  studentId: 'student-1',
  totalStudyMinutes: 120,
  totalExamAttempts: 1,
  passedExams: 1,
  avgExamScore: 80,
  coursesEnrolled: 2,
  coursesCompleted: 1,
  lastActivityAt: new Date('2026-06-01T00:00:00.000Z'),
  resetAt: null,
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
};

describe('StudentLearningProgress', () => {
  it('projects exam completion metrics deterministically', () => {
    const progress = StudentLearningProgress.reconstitute(baseProfile);

    const projection = progress.recordExamCompleted({
      sessionId: 'session-1',
      studentId: 'student-1',
      score: 60,
      isPassed: false,
      occurredAt: '2026-06-04T10:30:00.000Z',
      questions: [
        { questionId: 'q1', isCorrect: true },
        { questionId: 'q2', isCorrect: false },
      ],
    });

    expect(projection.totalExamAttempts).toBe(2);
    expect(projection.passedExams).toBe(1);
    expect(projection.avgExamScore).toBe(70);
    expect(projection.questionsAnswered).toBe(2);
    expect(projection.correctAnswers).toBe(1);
    expect(projection.date.toISOString()).toBe('2026-06-04T00:00:00.000Z');
  });

  it('builds dashboard ratios and weak topics in the domain layer', () => {
    const progress = StudentLearningProgress.reconstitute(baseProfile);

    const dashboard = progress.buildDashboard(
      [
        {
          date: new Date('2026-06-04T00:00:00.000Z'),
          examsAttempted: 1,
          correctAnswers: 2,
          questionsAnswered: 3,
        },
      ],
      [
        {
          topicId: 'topic-1',
          topicName: 'Signs',
          totalAttempts: 4,
          correctAttempts: 1,
        },
      ],
    );

    expect(dashboard.passRate).toBe(100);
    expect(dashboard.completionPct).toBe(50);
    expect(dashboard.weakTopics).toEqual([
      {
        topicId: 'topic-1',
        topicName: 'Signs',
        incorrectCount: 3,
        accuracyRate: 0.25,
      },
    ]);
  });
});
