export class GetLessonQuery {
  constructor(
    readonly courseId: string,
    readonly lessonId: string,
  ) {}
}
