import { DomainEvent } from '@repo/common';

export class FileUploadedEvent extends DomainEvent {
  get eventName(): string {
    return 'media.file.uploaded';
  }

  constructor(
    readonly fileId: string,
    readonly storageKey: string,
    readonly originalName: string,
    readonly mimeType: string,
    readonly fileSize: number,
    readonly uploadedById: string,
  ) {
    super();
  }
}
