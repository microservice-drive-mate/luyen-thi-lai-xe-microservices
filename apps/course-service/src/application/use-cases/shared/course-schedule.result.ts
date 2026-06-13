import { CourseScheduleRecord } from '../../../domain/repositories/course-schedule.repository';

export class CourseScheduleResult {
  constructor(
    readonly id: string,
    readonly courseId: string,
    readonly instructorId: string,
    readonly dayOfWeek: number,
    readonly startTime: string,
    readonly endTime: string,
    readonly room: string | null,
    readonly effectiveFrom: Date,
    readonly effectiveTo: Date | null,
    readonly isActive: boolean,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static fromRecord(record: CourseScheduleRecord): CourseScheduleResult {
    return new CourseScheduleResult(
      record.id,
      record.courseId,
      record.instructorId,
      record.dayOfWeek,
      record.startTime,
      record.endTime,
      record.room,
      record.effectiveFrom,
      record.effectiveTo,
      record.isActive,
      record.createdAt,
      record.updatedAt,
    );
  }
}
