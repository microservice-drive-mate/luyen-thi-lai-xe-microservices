export class InitiateUploadResult {
  constructor(
    readonly mediaFileId: string,
    readonly uploadUrl: string,
    readonly publicUrl: string,
    readonly expiresAt: Date,
  ) {}
}
