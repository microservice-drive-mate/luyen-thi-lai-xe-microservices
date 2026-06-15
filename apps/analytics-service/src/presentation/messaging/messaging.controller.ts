import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { RecordDashboardEventUseCase } from '../../application/use-cases/record-dashboard-event/record-dashboard-event.use-case';
import { RecordLearningEventUseCase } from '../../application/use-cases/record-events/record-events.use-case';
import type { DashboardActivityType } from '../../domain/dashboard/admin-dashboard.types';
import type { ExamCompletedPayload } from '../../domain/repositories/learning-progress.repository';
import { InstructorDashboardRepository } from '../../domain/repositories/instructor-dashboard.repository';
import { ProgressCacheService } from '../../infrastructure/cache/progress-cache.service';

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
    private readonly instructorDashboardRepository: InstructorDashboardRepository,
    private readonly cache: ProgressCacheService,
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
      await this.cache.invalidateInstructorDashboard();
    });
  }

  @EventPattern('exam.session.completed')
  async handleExamCompleted(
    @Payload() payload: DashboardEventPayload,
  ): Promise<void> {
    await this.handleSafely('exam.session.completed', async () => {
      const sessionId = readString(payload, 'sessionId');
      const studentId = readString(payload, 'studentId');
      const score = readNumber(payload, 'score') ?? 0;
      const isPassed = readBoolean(payload, 'isPassed');
      if (!sessionId || !studentId || isPassed === undefined) return;
      const questions = readExamQuestions(payload);
      const examPayload: ExamCompletedPayload = {
        sessionId,
        studentId,
        score,
        isPassed,
        occurredAt:
          typeof payload.occurredAt === 'string'
            ? payload.occurredAt
            : undefined,
        questions,
      };
      await this.recordLearningEventUseCase.execute({
        type: 'exam-completed',
        payload: examPayload,
      });
      const eventId = deriveEventId('exam.session.completed', payload);
      const occurredAt = readOccurredAt(payload);
      const licenseCategory =
        readString(payload, 'licenseCategory') ?? 'UNKNOWN';
      await this.recordDashboardEventUseCase.execute({
        eventId,
        eventName: 'exam.session.completed',
        exam: {
          sessionId,
          studentId,
          score,
          isPassed,
          licenseCategory,
          completedAt: occurredAt,
        },
        activity: {
          eventId,
          type: 'exam',
          title: `Học viên ${payload.studentId} hoàn thành bài thi ${licenseCategory} - ${
            payload.isPassed ? 'Đạt' : 'Không đạt'
          }`,
          description: `Score: ${score}`,
          resourceType: 'EXAM_SESSION',
          resourceId: sessionId,
          licenseCategory,
          occurredAt,
        },
      });
      await this.instructorDashboardRepository.recordExamCompleted({
        sessionId,
        studentId,
        score,
        isPassed,
        completedAt: occurredAt,
        questions,
      });
      await this.cache.invalidateInstructorDashboard();
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

  @EventPattern('course.schedule.created')
  async handleCourseScheduleCreated(
    @Payload() payload: DashboardEventPayload,
  ): Promise<void> {
    await this.handleSafely('course.schedule.created', async () => {
      await this.recordScheduleProjection(payload);
    });
  }

  @EventPattern('course.schedule.updated')
  async handleCourseScheduleUpdated(
    @Payload() payload: DashboardEventPayload,
  ): Promise<void> {
    await this.handleSafely('course.schedule.updated', async () => {
      await this.recordScheduleProjection(payload);
    });
  }

  @EventPattern('course.schedule.deleted')
  async handleCourseScheduleDeleted(
    @Payload() payload: DashboardEventPayload,
  ): Promise<void> {
    await this.handleSafely('course.schedule.deleted', async () => {
      const scheduleId = readString(payload, 'scheduleId');
      if (!scheduleId) return;
      await this.instructorDashboardRepository.deactivateSchedule(scheduleId);
      await this.cache.invalidateInstructorDashboard(
        readString(payload, 'instructorId'),
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
      await this.recordInstructorEnrollmentProjection(payload, 'ACTIVE', 0);
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
      await this.recordInstructorEnrollmentProjection(
        payload,
        'COMPLETED',
        100,
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
      await this.recordInstructorEnrollmentProjection(payload);
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
      await this.recordInstructorEnrollmentProjection(payload, 'ACTIVE', 0);
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
    if (user?.role === 'STUDENT') {
      await this.cache.invalidateInstructorDashboard();
    }
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
    await this.instructorDashboardRepository.upsertCourseProjection({
      courseId,
      title,
      licenseCategory,
      status,
      isDeleted: readBoolean(payload, 'isDeleted') ?? action === 'archived',
      capacity: readNumber(payload, 'capacity') ?? null,
      totalLessons: readNumber(payload, 'totalLessons') ?? 0,
      instructorIds: readStringArray(payload, 'instructorIds'),
      createdAt: occurredAt,
      updatedAt: occurredAt,
    });
    await this.cache.invalidateInstructorDashboard();
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

  private async recordInstructorEnrollmentProjection(
    payload: DashboardEventPayload,
    fallbackStatus?: string,
    fallbackProgress?: number,
  ): Promise<void> {
    const enrollmentId = readString(payload, 'enrollmentId');
    const courseId = readString(payload, 'courseId');
    const studentId = readString(payload, 'studentId');
    if (!enrollmentId || !courseId || !studentId) return;
    await this.instructorDashboardRepository.upsertEnrollmentProjection({
      enrollmentId,
      courseId,
      studentId,
      status: readString(payload, 'status') ?? fallbackStatus ?? 'ACTIVE',
      progress: readNumber(payload, 'progress') ?? fallbackProgress ?? 0,
      enrolledAt: readOccurredAt(payload),
      completedAt:
        (readString(payload, 'status') ?? fallbackStatus) === 'COMPLETED'
          ? readOccurredAt(payload)
          : null,
    });
    await this.cache.invalidateInstructorDashboard();
  }

  private async recordScheduleProjection(
    payload: DashboardEventPayload,
  ): Promise<void> {
    const scheduleId = readString(payload, 'scheduleId');
    const courseId = readString(payload, 'courseId');
    const instructorId = readString(payload, 'instructorId');
    const effectiveFrom = readDateOnly(payload, 'effectiveFrom');
    if (!scheduleId || !courseId || !instructorId || !effectiveFrom) return;
    await this.instructorDashboardRepository.upsertScheduleProjection({
      scheduleId,
      courseId,
      instructorId,
      dayOfWeek: readNumber(payload, 'dayOfWeek') ?? 1,
      startTime: readString(payload, 'startTime') ?? '00:00',
      endTime: readString(payload, 'endTime') ?? '00:00',
      room: readString(payload, 'room') ?? null,
      effectiveFrom,
      effectiveTo: readDateOnly(payload, 'effectiveTo'),
      isActive: readBoolean(payload, 'isActive') ?? true,
    });
    await this.cache.invalidateInstructorDashboard(instructorId);
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

function readNumber(
  payload: DashboardEventPayload,
  key: string,
): number | undefined {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function readExamQuestions(
  payload: DashboardEventPayload,
): NonNullable<ExamCompletedPayload['questions']> {
  const value = payload.questions;
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is DashboardEventPayload => isObjectRecord(item))
    .map((item) => ({
      questionId: readString(item, 'questionId') ?? '',
      topicId: readNullableString(item, 'topicId'),
      topicName: readNullableString(item, 'topicName'),
      isCorrect: readBoolean(item, 'isCorrect') ?? null,
    }))
    .filter((item) => item.questionId.length > 0);
}

function readStringArray(
  payload: DashboardEventPayload,
  key: string,
): string[] {
  const value = payload[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function readDateOnly(
  payload: DashboardEventPayload,
  key: string,
): Date | null {
  const value = readString(payload, key);
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readNullableString(
  payload: DashboardEventPayload,
  key: string,
): string | null {
  return readString(payload, key) ?? null;
}

function isObjectRecord(value: unknown): value is DashboardEventPayload {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
