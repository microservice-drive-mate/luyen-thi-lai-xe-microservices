export class GetPresignedUrlQuery {
  constructor(
    readonly fileId: string,
    readonly expiresIn: number = 3600,
  ) {}
}
