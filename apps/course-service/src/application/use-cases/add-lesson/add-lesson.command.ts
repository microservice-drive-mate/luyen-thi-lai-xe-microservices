export class AddLessonCommand {
  constructor(
    readonly courseId: string,
    readonly title: string,
    readonly order: number,
    readonly content?: string | null,
    readonly videoUrl?: string | null,
    readonly durationMinutes?: number,
  ) {}
}
