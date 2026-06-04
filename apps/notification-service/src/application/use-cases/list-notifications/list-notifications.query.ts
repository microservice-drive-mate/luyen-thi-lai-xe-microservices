export class ListNotificationsQuery {
  constructor(
    readonly userId: string,
    readonly page: number,
    readonly size: number,
  ) {}
}
