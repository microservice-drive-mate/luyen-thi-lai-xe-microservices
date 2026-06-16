export class DeleteCourseScheduleCommand {
  constructor(
    readonly courseId: string,
    readonly scheduleId: string,
  ) {}
}
