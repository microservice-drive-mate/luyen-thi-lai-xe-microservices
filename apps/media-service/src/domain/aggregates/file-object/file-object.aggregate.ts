import { AggregateRoot } from '@repo/common';
import { FileSize } from '../../value-objects/file-size.vo';
import { MimeType } from '../../value-objects/mime-type.vo';
import { FileDeletedEvent } from '../../events/file-deleted.event';
import { FileUploadedEvent } from '../../events/file-uploaded.event';
import {
  CreateFileObjectProps,
  FileStatus,
  ReconstituteFileObjectProps,
} from './file-object.types';

export class FileObject extends AggregateRoot<string> {
  private _storageKey: string;
  private _originalName: string;
  private _mimeType: MimeType;
  private _fileSize: FileSize;
  private _bucketName: string;
  private _uploadedById: string;
  private _isPublic: boolean;
  private _status: FileStatus;
  private _createdAt: Date;

  private constructor(
    id: string,
    storageKey: string,
    originalName: string,
    mimeType: MimeType,
    fileSize: FileSize,
    bucketName: string,
    uploadedById: string,
    isPublic: boolean,
    status: FileStatus,
    createdAt: Date,
  ) {
    super(id);
    this._storageKey = storageKey;
    this._originalName = originalName;
    this._mimeType = mimeType;
    this._fileSize = fileSize;
    this._bucketName = bucketName;
    this._uploadedById = uploadedById;
    this._isPublic = isPublic;
    this._status = status;
    this._createdAt = createdAt;
  }

  static create(props: CreateFileObjectProps): FileObject {
    const mimeType = MimeType.create(props.mimeType);
    const fileSize = FileSize.create(props.fileSize);

    const fileObject = new FileObject(
      props.id,
      props.storageKey,
      props.originalName,
      mimeType,
      fileSize,
      props.bucketName,
      props.uploadedById,
      props.isPublic ?? false,
      props.status ?? FileStatus.LINKED,
      new Date(),
    );

    if (props.status !== FileStatus.UNLINKED) {
      fileObject.addDomainEvent(
        new FileUploadedEvent(
          props.id,
          props.storageKey,
          props.originalName,
          mimeType.value,
          fileSize.value,
          props.uploadedById,
        ),
      );
    }

    return fileObject;
  }

  static reconstitute(props: ReconstituteFileObjectProps): FileObject {
    return new FileObject(
      props.id,
      props.storageKey,
      props.originalName,
      MimeType.reconstitute(props.mimeType),
      FileSize.reconstitute(props.fileSize),
      props.bucketName,
      props.uploadedById,
      props.isPublic,
      props.status,
      props.createdAt,
    );
  }

  markDeleted(deletedById: string): void {
    this.addDomainEvent(
      new FileDeletedEvent(this.id, this._storageKey, deletedById),
    );
  }

  link(): void {
    this._status = FileStatus.LINKED;
  }

  get storageKey(): string {
    return this._storageKey;
  }
  get originalName(): string {
    return this._originalName;
  }
  get mimeType(): string {
    return this._mimeType.value;
  }
  get fileSize(): number {
    return this._fileSize.value;
  }
  get bucketName(): string {
    return this._bucketName;
  }
  get uploadedById(): string {
    return this._uploadedById;
  }
  get isPublic(): boolean {
    return this._isPublic;
  }
  get status(): FileStatus {
    return this._status;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
