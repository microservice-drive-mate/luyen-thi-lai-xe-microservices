export class AddCourseMaterialCommand {
  constructor(
    readonly courseId: string,
    readonly title: string,
    readonly fileUrl?: string | null,
    readonly type?: string | null,
  ) {}
}
