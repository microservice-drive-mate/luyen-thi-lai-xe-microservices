export class RemoveLessonCommand {
  constructor(
    readonly courseId: string,
    readonly lessonId: string,
  ) {}
}
