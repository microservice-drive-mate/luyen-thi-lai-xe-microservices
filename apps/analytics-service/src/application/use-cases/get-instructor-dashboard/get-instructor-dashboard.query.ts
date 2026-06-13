export class GetInstructorDashboardQuery {
  constructor(
    readonly instructorId: string,
    readonly month?: string,
    readonly weekStart?: string,
    readonly date?: string,
  ) {}
}
