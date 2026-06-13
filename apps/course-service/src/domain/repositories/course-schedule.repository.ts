export interface CourseScheduleRecord {
  id: string;
  courseId: string;
  instructorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseScheduleInput {
  courseId: string;
  instructorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string | null;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  isActive?: boolean;
}

export abstract class CourseScheduleRepository {
  abstract findById(id: string): Promise<CourseScheduleRecord | null>;
  abstract listByCourse(courseId: string): Promise<CourseScheduleRecord[]>;
  abstract create(input: CourseScheduleInput): Promise<CourseScheduleRecord>;
  abstract update(
    id: string,
    input: Partial<CourseScheduleInput>,
  ): Promise<CourseScheduleRecord>;
  abstract deactivate(id: string): Promise<CourseScheduleRecord>;
}
