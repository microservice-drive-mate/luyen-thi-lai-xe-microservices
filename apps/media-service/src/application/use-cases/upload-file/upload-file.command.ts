export class UploadFileCommand {
  constructor(
    readonly buffer: Buffer,
    readonly originalName: string,
    readonly mimeType: string,
    readonly fileSize: number,
    readonly uploadedById: string,
    readonly isPublic: boolean = false,
  ) {}
}
