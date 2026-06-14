export class UpdateNotificationPreferencesCommand {
  constructor(
    readonly userId: string,
    readonly inAppEnabled?: boolean,
    readonly emailEnabled?: boolean,
    readonly pushEnabled?: boolean,
    readonly smsEnabled?: boolean,
    readonly studyReminderEnabled?: boolean,
    readonly examReminderEnabled?: boolean,
    readonly courseUpdateEnabled?: boolean,
    readonly academicWarningEnabled?: boolean,
  ) {}
}
