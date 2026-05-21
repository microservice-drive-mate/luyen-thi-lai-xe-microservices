import { DomainEvent } from '@repo/common';

export class FileDeletedEvent extends DomainEvent {
  get eventName(): string {
    return 'media.file.deleted';
  }

  constructor(
    readonly fileId: string,
    readonly storageKey: string,
    readonly deletedById: string,
  ) {
    super();
  }
}
