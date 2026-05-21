export class FileObjectResult {
  constructor(
    readonly id: string,
    readonly storageKey: string,
    readonly originalName: string,
    readonly mimeType: string,
    readonly fileSize: number,
    readonly bucketName: string,
    readonly uploadedById: string,
    readonly isPublic: boolean,
    readonly createdAt: Date,
  ) {}
}
