export class CompleteLessonCommand {
  constructor(
    readonly enrollmentId: string,
    readonly lessonId: string,
  ) {}
}
