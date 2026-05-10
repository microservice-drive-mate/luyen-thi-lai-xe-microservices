export class CompleteLessonCommand {
  constructor(
    readonly enrollmentId: string,
    readonly lessonId: string,
    readonly watchedSeconds?: number,
  ) {}
}
