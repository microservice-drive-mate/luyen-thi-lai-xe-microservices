export class InitiateUploadCommand {
  constructor(
    readonly originalName: string,
    readonly mimeType: string,
    readonly fileSize: number,
    readonly uploadedById: string,
  ) {}
}
