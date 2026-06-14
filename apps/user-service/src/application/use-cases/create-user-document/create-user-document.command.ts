import { UserDocumentStatus, UserDocumentType } from '@prisma/user-client';

export class CreateUserDocumentCommand {
  constructor(
    readonly userId: string,
    readonly type: UserDocumentType,
    readonly mediaFileId: string,
    readonly title?: string,
    readonly status?: UserDocumentStatus,
  ) {}
}
