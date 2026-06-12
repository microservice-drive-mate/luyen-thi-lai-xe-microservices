import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { RecordDashboardEventUseCase } from '../../application/use-cases/record-dashboard-event/record-dashboard-event.use-case';
import { RecordLearningEventUseCase } from '../../application/use-cases/record-events/record-events.use-case';
import type { DashboardActivityType } from '../../domain/dashboard/admin-dashboard.types';
import type { ExamCompletedPayload } from '../../domain/repositories/learning-progress.repository';

type DashboardEventPayload = Record<string, unknown>;

interface StudentPayload extends DashboardEventPayload {
  userId?: string;
  studentId?: string;
  role?: string;
}

@Controller()
export class MessagingController {
  private readonly logger = new Logger(MessagingController.name);

  constructor(
    private readonly recordLearningEventUseCase: RecordLearningEventUseCase,
    private readonly recordDashboardEventUseCase: RecordDashboardEventUseCase,
  ) {}

  @EventPattern('identity.user.created')
  async handleUserCreated(@Payload() payload: StudentPayload): Promise<void> {
    await this.handleSafely('identity.user.created', async () => {
      if (!payload.role || payload.role === 'STUDENT') {
        const studentId = payload.studentId ?? payload.userId;
        if (studentId) {
          await this.recordLearningEventUseCase.execute({
            type: 'student-created',
            studentId,
          });
        }
      }
      await this.recordUserDashboardEvent('identity.user.created', payload, {
        action: 'created',
      });
    });
  }

  @EventPattern('identity.user.updated')
  async handleUserUpdated(@Payload() payload: StudentPayload): Promise<void> {
    await this.handleSafely('identity.user.updated', async () => {
      await this.recordUserDashboardEvent('identity.user.updated', payload, {
        action: 'updated',
      });
    });
  }

  @EventPattern('identity.user.deleted')
  async handleUserDeleted(@Payload() payload: StudentPayload): Promise<void> {
    await this.handleSafely('identity.user.deleted', async () => {
      await this.recordUserDashboardEvent('identity.user.deleted', payload, {
        action: 'deleted',
        isActive: false,
      });
    });
  }

  @EventPattern('identity.user.role-changed')
  async handleUserRoleChanged(
    @Payload() payload: StudentPayload,
  ): Promise<void> {
    await this.handleSafely('identity.user.role-changed', async () => {
      await this.recordUserDashboardEvent(
        'identity.user.role-changed',
        payload,
        {
          action: 'role-changed',
        },
      );
    });
  }

  @EventPattern('identity.user.locked')
  async handleUserLocked(@Payload() payload: StudentPayload): Promise<void> {
    await this.handleSafely('identity.user.locked', async () => {
      await this.recordUserDashboardEvent('identity.user.locked', payload, {
        action: 'locked',
        isActive: !readBoolean(payload, 'locked'),
      });
    });
  }

  @EventPattern('user.student.license-assigned')
  async handleStudentLicenseAssigned(
    @Payload() payload: DashboardEventPayload,
  ): Promise<void> {
    await this.handleSafely('user.student.license-assigned', async () => {
      const studentId = readString(payload, 'studentId');
      if (!studentId) return;
      const occurredAt = readOccurredAt(payload);
      const fullName = readString(payload, 'studentFullName');
      const licenseTier = readString(payload, 'newLicenseTier');
      const eventId = deriveEventId('user.student.license-assigned', payload);
      await this.recordDashboardEventUseCase.execute({
        eventId,
        eventName: 'user.student.license-assigned',
        user: {
          userId: studentId,
          fullName,
          email: readString(payload, 'studentEmail'),
          role: 'STUDENT',
          isActive: true,
          licenseTier,
          createdAt: occurredAt,
          updatedAt: occurredAt,
        },
        activity: {
          eventId,
          type: 'student',
          title:
            `${fullName ?? studentId} được gán hạng bằng ${licenseTier ?? ''}`.trim(),
          description: 'Student license tier was assigned',
          actorId: readString(payload, 'changedById'),
          resourceType: 'STUDENT',
          resourceId: studentId,
          licenseCategory: licenseTier,
          occurredAt,
        },
      });
    });
  }

  @EventPattern('exam.session.completed')
  async handleExamCompleted(
    @Payload() payload: ExamCompletedPayload & DashboardEventPayload,
  ): Promise<void> {
    await this.handleSafely('exam.session.completed', async () => {
      await this.recordLearningEventUseCase.execute({
        type: 'exam-completed',
        payload,
      });
      const eventId = deriveEventId('exam.session.completed', payload);
      const occurredAt = readOccurredAt(payload);
      const licenseCategory =
        readString(payload, 'licenseCategory') ?? 'UNKNOWN';
      await this.recordDashboardEventUseCase.execute({
        eventId,
        eventName: 'exam.session.completed',
        exam: {
          sessionId: payload.sessionId,
          studentId: payload.studentId,
          score: payload.score,
          isPassed: payload.isPassed,
          licenseCategory,
          completedAt: occurredAt,
        },
        activity: {
          eventId,
          type: 'exam',
          title: `Học viên ${payload.studentId} hoàn thành bài thi ${licenseCategory} - ${
            payload.isPassed ? 'Đạt' : 'Không đạt'
          }`,
          description: `Score: ${payload.score}`,
          resourceType: 'EXAM_SESSION',
          resourceId: payload.sessionId,
          licenseCategory,
          occurredAt,
        },
      });
    });
  }

  @EventPattern('course.created')
  async handleCourseCreated(
    @Payload() payload: DashboardEventPayload,
  ): Promise<void> {
    await this.handleSafely('course.created', async () => {
      await this.recordCourseDashboardEvent(
        'course.created',
        payload,
        'created',
      );
    });
  }

  @EventPattern('course.updated')
  async handleCourseUpdated(
    @Payload() payload: DashboardEventPayload,
  ): Promise<void> {
    await this.handleSafely('course.updated', async () => {
      await this.recordCourseDashboardEvent(
        'course.updated',
        payload,
        'updated',
      );
    });
  }

  @EventPattern('course.archived')
  async handleCourseArchived(
    @Payload() payload: DashboardEventPayload,
  ): Promise<void> {
    await this.handleSafely('course.archived', async () => {
      await this.recordCourseDashboardEvent(
        'course.archived',
        payload,
        'archived',
      );
    });
  }

  @EventPattern('course.enrollment.created')
  async handleEnrollmentCreated(
    @Payload() payload: StudentPayload,
  ): Promise<void> {
    await this.handleSafely('course.enrollment.created', async () => {
      if (!payload.studentId) return;
      await this.recordLearningEventUseCase.execute({
        type: 'enrollment-created',
        studentId: payload.studentId,
      });
      await this.recordEnrollmentActivity(
        'course.enrollment.created',
        payload,
        'created',
      );
    });
  }

  @EventPattern('course.enrollment.completed')
  async handleEnrollmentCompleted(
    @Payload() payload: StudentPayload,
  ): Promise<void> {
    await this.handleSafely('course.enrollment.completed', async () => {
      if (!payload.studentId) return;
      await this.recordLearningEventUseCase.execute({
        type: 'enrollment-completed',
        studentId: payload.studentId,
      });
      await this.recordEnrollmentActivity(
        'course.enrollment.completed',
        payload,
        'completed',
      );
    });
  }

  @EventPattern('course.lesson.completed')
  async handleLessonCompleted(
    @Payload() payload: StudentPayload,
  ): Promise<void> {
    await this.handleSafely('course.lesson.completed', async () => {
      if (!payload.studentId) return;
      await this.recordLearningEventUseCase.execute({
        type: 'lesson-completed',
        studentId: payload.studentId,
      });
      await this.recordEnrollmentActivity(
        'course.lesson.completed',
        payload,
        'lesson-completed',
      );
    });
  }

  @EventPattern('course.enrollment.progress-reset')
  async handleProgressReset(@Payload() payload: StudentPayload): Promise<void> {
    await this.handleSafely('course.enrollment.progress-reset', async () => {
      if (!payload.studentId) return;
      this.logger.log(
        `Resetting analytics projection for student ${payload.studentId}`,
      );
      await this.recordLearningEventUseCase.execute({
        type: 'progress-reset',
        studentId: payload.studentId,
      });
    });
  }

  @EventPattern('security.audit.recorded')
  async handleAuditRecorded(
    @Payload() payload: DashboardEventPayload,
  ): Promise<void> {
    await this.handleSafely('security.audit.recorded', async () => {
      const eventId = deriveEventId('security.audit.recorded', payload);
      const occurredAt = readOccurredAt(payload);
      const action = readString(payload, 'action') ?? 'AUDIT_RECORDED';
      const resourceType = readString(payload, 'resourceType') ?? 'RESOURCE';
      const resourceId = readString(payload, 'resourceId');
      await this.recordDashboardEventUseCase.execute({
        eventId,
        eventName: 'security.audit.recorded',
        activity: {
          eventId,
          type: 'audit',
          title: `${action} ${resourceType}${resourceId ? ` ${resourceId}` : ''}`,
          description:
            readString(payload, 'serviceName') ?? 'Audit event recorded',
          actorId: readString(payload, 'actorId'),
          resourceType,
          resourceId,
          occurredAt,
        },
      });
    });
  }

  private async recordUserDashboardEvent(
    eventName: string,
    payload: StudentPayload,
    options: { action: string; isActive?: boolean },
  ): Promise<void> {
    const userId = payload.studentId ?? payload.userId;
    if (!userId) return;

    const eventId = deriveEventId(eventName, payload);
    const occurredAt = readOccurredAt(payload);
    const fullName = readString(payload, 'fullName');
    const role = readString(payload, 'role') ?? readString(payload, 'newRole');
    const activityType: DashboardActivityType =
      role === 'STUDENT' ? 'student' : 'audit';
    const user =
      role === undefined
        ? undefined
        : {
            userId,
            fullName,
            email: readString(payload, 'email'),
            role,
            isActive: options.isActive ?? true,
            licenseTier: readString(payload, 'licenseTier'),
            createdAt: occurredAt,
            updatedAt: occurredAt,
          };

    await this.recordDashboardEventUseCase.execute({
      eventId,
      eventName,
      user,
      activity: {
        eventId,
        type: activityType,
        title: buildUserTitle(fullName ?? userId, options.action, role),
        description: eventName,
        actorId: readString(payload, 'deletedById'),
        actorName: fullName,
        resourceType: 'USER',
        resourceId: userId,
        licenseCategory: readString(payload, 'licenseTier'),
        occurredAt,
      },
    });
  }

  private async recordCourseDashboardEvent(
    eventName: string,
    payload: DashboardEventPayload,
    action: 'created' | 'updated' | 'archived',
  ): Promise<void> {
    const courseId = readString(payload, 'courseId');
    const licenseCategory = readString(payload, 'licenseCategory');
    if (!courseId || !licenseCategory) return;

    const eventId = deriveEventId(eventName, payload);
    const occurredAt = readOccurredAt(payload);
    const title = readString(payload, 'title');
    const status =
      readString(payload, 'status') ??
      (action === 'archived' ? 'ARCHIVED' : 'DRAFT');

    await this.recordDashboardEventUseCase.execute({
      eventId,
      eventName,
      course: {
        courseId,
        title,
        licenseCategory,
        status,
        isDeleted: readBoolean(payload, 'isDeleted') ?? action === 'archived',
        createdAt: occurredAt,
        updatedAt: occurredAt,
      },
      activity: {
        eventId,
        type: 'course',
        title: `Khóa học ${title ?? courseId} đã được ${courseActionText(action)}`,
        description: eventName,
        resourceType: 'COURSE',
        resourceId: courseId,
        licenseCategory,
        occurredAt,
      },
    });
  }

  private async recordEnrollmentActivity(
    eventName: string,
    payload: StudentPayload,
    action: 'created' | 'completed' | 'lesson-completed',
  ): Promise<void> {
    const eventId = deriveEventId(eventName, payload);
    const occurredAt = readOccurredAt(payload);
    await this.recordDashboardEventUseCase.execute({
      eventId,
      eventName,
      activity: {
        eventId,
        type: 'course',
        title: buildEnrollmentTitle(payload.studentId ?? 'unknown', action),
        description: eventName,
        resourceType: 'COURSE',
        resourceId: readString(payload, 'courseId'),
        occurredAt,
      },
    });
  }

  private async handleSafely(
    eventName: string,
    handler: () => Promise<void>,
  ): Promise<void> {
    try {
      await handler();
    } catch (error) {
      this.logger.error(
        `Failed to handle ${eventName}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}

function deriveEventId(
  eventName: string,
  payload: DashboardEventPayload,
): string {
  const explicit = readString(payload, 'eventId');
  if (explicit) return explicit;
  const resourceId =
    readString(payload, 'resourceId') ??
    readString(payload, 'sessionId') ??
    readString(payload, 'enrollmentId') ??
    readString(payload, 'lessonId') ??
    readString(payload, 'courseId') ??
    readString(payload, 'studentId') ??
    readString(payload, 'userId') ??
    'unknown';
  const occurredAt = readString(payload, 'occurredAt') ?? 'unknown';
  return `${eventName}:${resourceId}:${occurredAt}`;
}

function readOccurredAt(payload: DashboardEventPayload): Date {
  const raw = payload.occurredAt;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'string') {
    const value = new Date(raw);
    if (!Number.isNaN(value.getTime())) return value;
  }
  return new Date();
}

function readString(
  payload: DashboardEventPayload,
  key: string,
): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readBoolean(
  payload: DashboardEventPayload,
  key: string,
): boolean | undefined {
  return typeof payload[key] === 'boolean' ? payload[key] : undefined;
}

function buildUserTitle(label: string, action: string, role?: string): string {
  if (action === 'created') return `${label} đã được tạo`;
  if (action === 'updated') return `${label} đã được cập nhật`;
  if (action === 'deleted') return `${label} đã bị xóa`;
  if (action === 'locked') return `${label} đã thay đổi trạng thái khóa`;
  if (action === 'role-changed')
    return `${label} đã đổi vai trò ${role ?? ''}`.trim();
  return label;
}

function courseActionText(action: 'created' | 'updated' | 'archived'): string {
  if (action === 'created') return 'tạo';
  if (action === 'updated') return 'cập nhật';
  return 'lưu trữ';
}

function buildEnrollmentTitle(
  studentId: string,
  action: 'created' | 'completed' | 'lesson-completed',
): string {
  if (action === 'created') return `Học viên ${studentId} đã ghi danh khóa học`;
  if (action === 'completed')
    return `Học viên ${studentId} đã hoàn thành khóa học`;
  return `Học viên ${studentId} đã hoàn thành bài học`;
}
