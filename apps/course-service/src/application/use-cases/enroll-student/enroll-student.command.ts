export class EnrollStudentCommand {
  constructor(
    readonly courseId: string,
    readonly studentId: string,
  ) {}
}
