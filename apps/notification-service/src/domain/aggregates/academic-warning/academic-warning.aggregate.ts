export enum AcademicWarningDeliveryStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  PENDING_RETRY = 'PENDING_RETRY',
  FAILED = 'FAILED',
  SENT = 'SENT',
}

export interface AcademicWarningSnapshot {
  id: string;
  studentId: string;
  reason: string;
  severity: string;
  message: string;
  createdById: string;
  deliveryStatus: AcademicWarningDeliveryStatus;
  retryAttempts: number;
  nextRetryAt: Date | null;
  notificationId: string | null;
  lastError: string | null;
  queuedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAcademicWarningProps {
  id: string;
  studentId: string;
  reason: string;
  severity: string;
  message: string;
  createdById: string;
}

const DEFAULT_RETRY_DELAY_MS = 5 * 60_000;
const DEFAULT_MAX_RETRY_ATTEMPTS = 3;

export class AcademicWarning {
  private constructor(private readonly props: AcademicWarningSnapshot) {}

  static create(
    props: CreateAcademicWarningProps,
    now = new Date(),
  ): AcademicWarning {
    return new AcademicWarning({
      id: props.id,
      studentId: props.studentId,
      reason: props.reason,
      severity: props.severity,
      message: props.message,
      createdById: props.createdById,
      deliveryStatus: AcademicWarningDeliveryStatus.PENDING,
      retryAttempts: 0,
      nextRetryAt: null,
      notificationId: null,
      lastError: null,
      queuedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(snapshot: AcademicWarningSnapshot): AcademicWarning {
    return new AcademicWarning({ ...snapshot });
  }

  get id(): string {
    return this.props.id;
  }

  get studentId(): string {
    return this.props.studentId;
  }

  get reason(): string {
    return this.props.reason;
  }

  get severity(): string {
    return this.props.severity;
  }

  get message(): string {
    return this.props.message;
  }

  markQueued(notificationId: string | null, now = new Date()): void {
    this.props.deliveryStatus = AcademicWarningDeliveryStatus.QUEUED;
    this.props.notificationId = notificationId;
    this.props.queuedAt = now;
    this.props.nextRetryAt = null;
    this.props.lastError = null;
    this.props.updatedAt = now;
  }

  markPendingRetry(
    errorMessage: string,
    retryAttempts: number,
    now = new Date(),
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  ): void {
    this.props.deliveryStatus = AcademicWarningDeliveryStatus.PENDING_RETRY;
    this.props.retryAttempts = retryAttempts;
    this.props.lastError = errorMessage;
    this.props.nextRetryAt = new Date(now.getTime() + retryDelayMs);
    this.props.updatedAt = now;
  }

  recordRetryFailure(
    errorMessage: string,
    now = new Date(),
    maxAttempts = DEFAULT_MAX_RETRY_ATTEMPTS,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  ): void {
    const attempts = this.props.retryAttempts + 1;
    this.props.retryAttempts = attempts;
    this.props.lastError = errorMessage;
    this.props.deliveryStatus =
      attempts >= maxAttempts
        ? AcademicWarningDeliveryStatus.FAILED
        : AcademicWarningDeliveryStatus.PENDING_RETRY;
    this.props.nextRetryAt =
      attempts >= maxAttempts ? null : new Date(now.getTime() + retryDelayMs);
    this.props.updatedAt = now;
  }

  toSnapshot(): AcademicWarningSnapshot {
    return { ...this.props };
  }
}
