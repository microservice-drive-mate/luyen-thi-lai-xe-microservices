import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { SendAcademicWarningCommand } from '../../application/use-cases/send-academic-warning/send-academic-warning.command';
import { SendAcademicWarningUseCase } from '../../application/use-cases/send-academic-warning/send-academic-warning.use-case';
import { SendCourseUpdateCommand } from '../../application/use-cases/send-course-update/send-course-update.command';
import { SendCourseUpdateUseCase } from '../../application/use-cases/send-course-update/send-course-update.use-case';
import { SendExamResultCommand } from '../../application/use-cases/send-exam-result/send-exam-result.command';
import { SendExamResultUseCase } from '../../application/use-cases/send-exam-result/send-exam-result.use-case';
import { SendPasswordResetCommand } from '../../application/use-cases/send-password-reset/send-password-reset.command';
import { SendPasswordResetUseCase } from '../../application/use-cases/send-password-reset/send-password-reset.use-case';
import { SendWelcomeEmailCommand } from '../../application/use-cases/send-welcome-email/send-welcome-email.command';
import { SendWelcomeEmailUseCase } from '../../application/use-cases/send-welcome-email/send-welcome-email.use-case';
import { NotificationMetrics } from '../../infrastructure/metrics/notification.metrics';

interface RetryablePayload {
  retryCount?: number;
}

interface IdentityUserCreatedPayload extends RetryablePayload {
  userId: string;
  email: string;
  fullName?: string;
}

interface PasswordResetRequestedPayload extends RetryablePayload {
  userId: string;
  email: string;
  resetUrl: string;
}

interface ExamSessionPayload extends RetryablePayload {
  studentId?: string;
  userId?: string;
  email?: string;
  sessionId?: string;
  licenseCategory?: string;
  score?: number;
}

interface AcademicWarningQueuedPayload extends RetryablePayload {
  studentId: string;
  reason: string;
  severity: string;
  message: string;
  createdById: string;
  studentEmail?: string;
  warningId?: string;
}

interface CourseUpdatedPayload extends RetryablePayload {
  recipientId: string;
  recipientEmail?: string;
  courseId: string;
  courseTitle: string;
  updateSummary: string;
}

@Controller()
export class MessagingController {
  constructor(
    private readonly sendWelcomeEmailUseCase: SendWelcomeEmailUseCase,
    private readonly sendExamResultUseCase: SendExamResultUseCase,
    private readonly sendAcademicWarningUseCase: SendAcademicWarningUseCase,
    private readonly sendPasswordResetUseCase: SendPasswordResetUseCase,
    private readonly sendCourseUpdateUseCase: SendCourseUpdateUseCase,
    private readonly metrics: NotificationMetrics,
  ) {}

  @EventPattern('identity.user.created')
  async handleUserCreated(
    @Payload() payload: IdentityUserCreatedPayload,
  ): Promise<void> {
    this.metrics.recordConsumed('identity.user.created');
    if (!payload.userId || !payload.email) return;
    await this.sendWelcomeEmailUseCase.execute(
      new SendWelcomeEmailCommand(
        payload.userId,
        payload.email,
        payload.fullName,
        payload.retryCount,
      ),
    );
  }

  @EventPattern('identity.user.password-reset-requested')
  async handlePasswordReset(
    @Payload() payload: PasswordResetRequestedPayload,
  ): Promise<void> {
    this.metrics.recordConsumed('identity.user.password-reset-requested');
    if (!payload.userId || !payload.email || !payload.resetUrl) return;
    await this.sendPasswordResetUseCase.execute(
      new SendPasswordResetCommand(
        payload.userId,
        payload.email,
        payload.resetUrl,
        payload.retryCount,
      ),
    );
  }

  @EventPattern('exam.session.passed')
  async handleExamPassed(
    @Payload() payload: ExamSessionPayload,
  ): Promise<void> {
    this.metrics.recordConsumed('exam.session.passed');
    const userId = payload.studentId ?? payload.userId;
    if (!userId) return;
    await this.sendExamResultUseCase.execute(
      new SendExamResultCommand(
        'exam.session.passed',
        userId,
        payload.email,
        payload.licenseCategory,
        payload.sessionId,
        payload.score,
        payload.retryCount,
      ),
    );
  }

  @EventPattern('exam.session.failed')
  async handleExamFailed(
    @Payload() payload: ExamSessionPayload,
  ): Promise<void> {
    this.metrics.recordConsumed('exam.session.failed');
    const userId = payload.studentId ?? payload.userId;
    if (!userId) return;
    await this.sendExamResultUseCase.execute(
      new SendExamResultCommand(
        'exam.session.failed',
        userId,
        payload.email,
        payload.licenseCategory,
        payload.sessionId,
        payload.score,
        payload.retryCount,
      ),
    );
  }

  @EventPattern('notification.academic-warning.queued')
  async handleAcademicWarningQueued(
    @Payload() payload: AcademicWarningQueuedPayload,
  ): Promise<void> {
    this.metrics.recordConsumed('notification.academic-warning.queued');
    await this.sendAcademicWarningUseCase.execute(
      new SendAcademicWarningCommand(
        payload.studentId,
        payload.reason,
        payload.severity,
        payload.message,
        payload.createdById,
        payload.studentEmail,
        payload.warningId,
        payload.retryCount,
      ),
    );
  }

  @EventPattern('course.updated')
  async handleCourseUpdated(
    @Payload() payload: CourseUpdatedPayload,
  ): Promise<void> {
    this.metrics.recordConsumed('course.updated');
    if (!payload.recipientId) return;
    await this.sendCourseUpdateUseCase.execute(
      new SendCourseUpdateCommand(
        payload.recipientId,
        payload.courseId,
        payload.courseTitle,
        payload.updateSummary,
        payload.recipientEmail,
        payload.retryCount,
      ),
    );
  }
}
