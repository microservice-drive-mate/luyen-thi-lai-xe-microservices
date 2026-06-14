export class CreateCourseScheduleCommand {
  constructor(
    readonly courseId: string,
    readonly instructorId: string,
    readonly dayOfWeek: number,
    readonly startTime: string,
    readonly endTime: string,
    readonly room: string | null,
    readonly effectiveFrom: Date,
    readonly effectiveTo: Date | null,
  ) {}
}
