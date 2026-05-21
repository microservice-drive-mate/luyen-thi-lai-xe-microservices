export class PresignedUrlResult {
  constructor(
    readonly url: string,
    readonly expiresAt: Date,
  ) {}
}
