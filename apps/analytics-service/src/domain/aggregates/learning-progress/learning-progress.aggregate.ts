export interface ProgressDashboard {
  studentId: string;
  completionPct: number;
  studiedCount: number;
  attemptCount: number;
  passRate: number;
  totalStudyMinutes: number;
  avgExamScore: number;
  trend: Array<{
    date: string;
    attempts: number;
    correctAnswers: number;
    questionsAnswered: number;
  }>;
  weakTopics: Array<{
    topicId: string | null;
    topicName: string | null;
    incorrectCount: number;
    accuracyRate: number;
  }>;
  lastActivityAt: Date | null;
}

export interface ExamCompletedPayload {
  sessionId: string;
  studentId: string;
  score: number;
  isPassed: boolean;
  occurredAt?: string;
  questions?: Array<{
    questionId: string;
    topicId?: string | null;
    topicName?: string | null;
    isCorrect?: boolean | null;
  }>;
}

export interface LearningProfileSnapshot {
  id: string;
  studentId: string;
  totalStudyMinutes: number;
  totalExamAttempts: number;
  passedExams: number;
  avgExamScore: number;
  coursesEnrolled: number;
  coursesCompleted: number;
  lastActivityAt: Date | null;
  resetAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyActivitySnapshot {
  date: Date;
  examsAttempted: number;
  correctAnswers: number;
  questionsAnswered: number;
}

export interface QuestionAccuracySnapshot {
  topicId: string | null;
  topicName: string | null;
  totalAttempts: number;
  correctAttempts: number;
}

export interface ExamCompletionProjection {
  studentId: string;
  occurredAt: Date;
  date: Date;
  totalExamAttempts: number;
  passedExams: number;
  avgExamScore: number;
  questionsAnswered: number;
  correctAnswers: number;
  questions: NonNullable<ExamCompletedPayload['questions']>;
}

export interface LessonCompletionProjection {
  studentId: string;
  occurredAt: Date;
  date: Date;
  minutes: number;
}

export class StudentLearningProgress {
  private constructor(private readonly props: LearningProfileSnapshot) {}

  static create(studentId: string, now = new Date()): StudentLearningProgress {
    return new StudentLearningProgress({
      id: studentId,
      studentId,
      totalStudyMinutes: 0,
      totalExamAttempts: 0,
      passedExams: 0,
      avgExamScore: 0,
      coursesEnrolled: 0,
      coursesCompleted: 0,
      lastActivityAt: null,
      resetAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(
    snapshot: LearningProfileSnapshot,
  ): StudentLearningProgress {
    return new StudentLearningProgress({ ...snapshot });
  }

  recordExamCompleted(payload: ExamCompletedPayload): ExamCompletionProjection {
    const occurredAt = payload.occurredAt
      ? new Date(payload.occurredAt)
      : new Date();
    const attempts = this.props.totalExamAttempts;
    const avgExamScore =
      attempts === 0
        ? payload.score
        : (this.props.avgExamScore * attempts + payload.score) / (attempts + 1);
    const questions = payload.questions ?? [];
    const correctAnswers = questions.filter((item) => item.isCorrect).length;

    return {
      studentId: payload.studentId,
      occurredAt,
      date: toDateOnly(occurredAt),
      totalExamAttempts: attempts + 1,
      passedExams: this.props.passedExams + (payload.isPassed ? 1 : 0),
      avgExamScore,
      questionsAnswered: questions.length,
      correctAnswers,
      questions,
    };
  }

  recordLessonCompleted(
    minutes: number,
    now = new Date(),
  ): LessonCompletionProjection {
    return {
      studentId: this.props.studentId,
      occurredAt: now,
      date: toDateOnly(now),
      minutes,
    };
  }

  buildDashboard(
    trendRows: DailyActivitySnapshot[],
    weakRows: QuestionAccuracySnapshot[],
  ): ProgressDashboard {
    const passRate =
      this.props.totalExamAttempts === 0
        ? 0
        : Math.round(
            (this.props.passedExams / this.props.totalExamAttempts) * 100,
          );
    const completionPct =
      this.props.coursesEnrolled === 0
        ? 0
        : Math.min(
            100,
            Math.round(
              (this.props.coursesCompleted / this.props.coursesEnrolled) * 100,
            ),
          );

    const weakTopics = weakRows
      .map((row) => {
        const accuracyRate =
          row.totalAttempts === 0 ? 0 : row.correctAttempts / row.totalAttempts;
        return {
          topicId: row.topicId,
          topicName: row.topicName,
          incorrectCount: row.totalAttempts - row.correctAttempts,
          accuracyRate,
        };
      })
      .filter((row) => row.incorrectCount > 0)
      .sort((a, b) => b.incorrectCount - a.incorrectCount)
      .slice(0, 5);

    return {
      studentId: this.props.studentId,
      completionPct,
      studiedCount: this.props.totalStudyMinutes,
      attemptCount: this.props.totalExamAttempts,
      passRate,
      totalStudyMinutes: this.props.totalStudyMinutes,
      avgExamScore: this.props.avgExamScore,
      trend: trendRows.reverse().map((row) => ({
        date: row.date.toISOString().slice(0, 10),
        attempts: row.examsAttempted,
        correctAnswers: row.correctAnswers,
        questionsAnswered: row.questionsAnswered,
      })),
      weakTopics,
      lastActivityAt: this.props.lastActivityAt,
    };
  }
}

export function toDateOnly(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}
