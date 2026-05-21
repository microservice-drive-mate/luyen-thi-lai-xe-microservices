export class ListFilesQuery {
  constructor(
    readonly page: number = 1,
    readonly size: number = 20,
    readonly uploadedById?: string,
    readonly mimeType?: string,
  ) {}
}
