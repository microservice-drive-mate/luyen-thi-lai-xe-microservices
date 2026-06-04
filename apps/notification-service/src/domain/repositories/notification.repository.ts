import {
  AcademicWarning,
  AcademicWarningDeliveryStatus,
  AcademicWarningSnapshot,
} from '../aggregates/academic-warning/academic-warning.aggregate';
import {
  Notification,
  NotificationSnapshot,
  NotificationStatus,
  NotificationType,
} from '../aggregates/notification/notification.aggregate';

export {
  AcademicWarning,
  AcademicWarningDeliveryStatus,
  Notification,
  NotificationStatus,
  NotificationType,
};

export type NotificationRecord = NotificationSnapshot;
export type AcademicWarningRecord = AcademicWarningSnapshot;

export abstract class NotificationRepository {
  abstract createNotification(
    notification: Notification,
  ): Promise<NotificationRecord>;

  abstract createAcademicWarning(
    warning: AcademicWarning,
  ): Promise<AcademicWarningRecord>;

  abstract saveAcademicWarningDelivery(
    warning: AcademicWarning,
  ): Promise<AcademicWarningRecord>;

  abstract findWarningsDueForRetry(
    now: Date,
    take: number,
  ): Promise<AcademicWarningRecord[]>;

  abstract findByUser(
    userId: string,
    page: number,
    size: number,
  ): Promise<{
    items: NotificationRecord[];
    total: number;
  }>;

  abstract findByUserAndId(
    id: string,
    userId: string,
  ): Promise<NotificationRecord | null>;

  abstract saveNotificationReadState(
    notification: Notification,
  ): Promise<NotificationRecord>;

  abstract saveNotificationDelivery(
    notification: Notification,
  ): Promise<NotificationRecord>;
}
