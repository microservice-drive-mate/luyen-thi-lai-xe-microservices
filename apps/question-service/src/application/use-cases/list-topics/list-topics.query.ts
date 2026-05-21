export class ListTopicsQuery {
  constructor(
    readonly page: number,
    readonly size: number,
    readonly parentId?: string | null,
  ) {}
}
