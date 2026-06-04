export enum NotificationType {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
  SMS = 'SMS',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

export interface NotificationSnapshot {
  id: string;
  userId: string;
  type: NotificationType;
  eventType: string | null;
  title: string;
  body: string;
  data: unknown;
  status: NotificationStatus;
  retryCount: number;
  errorMessage: string | null;
  isRead: boolean;
  readAt: Date | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationProps {
  id: string;
  userId: string;
  title: string;
  body: string;
  data?: unknown;
  type?: NotificationType;
  eventType?: string;
  retryCount?: number;
}

export class Notification {
  private constructor(private readonly props: NotificationSnapshot) {}

  static createQueued(
    props: CreateNotificationProps,
    now = new Date(),
  ): Notification {
    return new Notification({
      id: props.id,
      userId: props.userId,
      title: props.title,
      body: props.body,
      type: props.type ?? NotificationType.IN_APP,
      eventType: props.eventType ?? null,
      data: props.data ?? {},
      status: NotificationStatus.QUEUED,
      retryCount: props.retryCount ?? 0,
      errorMessage: null,
      isRead: false,
      readAt: null,
      sentAt: null,
      deliveredAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static createDelivered(
    props: CreateNotificationProps,
    now = new Date(),
  ): Notification {
    const notification = Notification.createQueued(props, now);
    notification.markDelivered(now);
    return notification;
  }

  static reconstitute(snapshot: NotificationSnapshot): Notification {
    return new Notification({ ...snapshot });
  }

  get id(): string {
    return this.props.id;
  }

  get type(): NotificationType {
    return this.props.type;
  }

  markDelivered(now = new Date()): void {
    this.props.status = NotificationStatus.DELIVERED;
    this.props.errorMessage = null;
    this.props.deliveredAt = now;
    this.props.sentAt = this.props.sentAt ?? now;
    this.props.updatedAt = now;
  }

  markFailed(errorMessage: string, now = new Date()): void {
    this.props.status = NotificationStatus.FAILED;
    this.props.errorMessage = errorMessage;
    this.props.updatedAt = now;
  }

  markRead(now = new Date()): void {
    if (this.props.isRead) return;
    this.props.isRead = true;
    this.props.readAt = now;
    this.props.updatedAt = now;
  }

  toSnapshot(): NotificationSnapshot {
    return { ...this.props };
  }
}
