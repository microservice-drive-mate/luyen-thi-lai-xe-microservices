import {
  UserDocument,
  UserDocumentStatus,
  UserDocumentType,
} from '@prisma/user-client';

export class UserDocumentResult {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly type: UserDocumentType,
    readonly mediaFileId: string,
    readonly title: string | null,
    readonly status: UserDocumentStatus,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static fromRecord(record: UserDocument): UserDocumentResult {
    return new UserDocumentResult(
      record.id,
      record.userId,
      record.type,
      record.mediaFileId,
      record.title,
      record.status,
      record.createdAt,
      record.updatedAt,
    );
  }
}
