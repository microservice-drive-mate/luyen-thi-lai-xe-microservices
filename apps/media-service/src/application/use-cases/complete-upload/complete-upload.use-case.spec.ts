import { FileObject } from '../../../domain/aggregates/file-object/file-object.aggregate';
import { FileStatus } from '../../../domain/aggregates/file-object/file-object.types';
import { FileUploadNotCompletedException } from '../../../domain/exceptions/file-upload-not-completed.exception';
import { FileNotFoundException } from '../../../domain/exceptions/file-not-found.exception';
import { FileObjectRepository } from '../../../domain/repositories/file-object.repository';
import { StoragePort } from '../../ports/storage.port';
import { CompleteUploadCommand } from './complete-upload.command';
import { CompleteUploadUseCase } from './complete-upload.use-case';

describe('CompleteUploadUseCase', () => {
  let repository: jest.Mocked<FileObjectRepository>;
  let storage: jest.Mocked<StoragePort>;
  let useCase: CompleteUploadUseCase;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      list: jest.fn(),
    };
    storage = {
      upload: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      getPresignedUrl: jest.fn(),
      generateUploadSasUrl: jest.fn(),
    };
    useCase = new CompleteUploadUseCase(repository, storage);
  });

  it('marks an initiated upload as UPLOADED when the blob exists', async () => {
    const file = createFile(FileStatus.UNLINKED);
    repository.findById.mockResolvedValue(file);
    storage.exists.mockResolvedValue(true);

    const result = await useCase.execute(new CompleteUploadCommand(file.id));

    expect(storage.exists).toHaveBeenCalledWith(file.storageKey);
    expect(repository.save).toHaveBeenCalledWith(file);
    expect(file.status).toBe(FileStatus.UPLOADED);
    expect(result.status).toBe(FileStatus.UPLOADED);
  });

  it('fails when the file metadata does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(new CompleteUploadCommand('missing-file')),
    ).rejects.toBeInstanceOf(FileNotFoundException);

    expect(storage.exists).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('fails when Azure Blob does not contain the uploaded object yet', async () => {
    const file = createFile(FileStatus.UNLINKED);
    repository.findById.mockResolvedValue(file);
    storage.exists.mockResolvedValue(false);

    await expect(
      useCase.execute(new CompleteUploadCommand(file.id)),
    ).rejects.toBeInstanceOf(FileUploadNotCompletedException);

    expect(repository.save).not.toHaveBeenCalled();
    expect(file.status).toBe(FileStatus.UNLINKED);
  });

  it('does not downgrade an already LINKED file', async () => {
    const file = createFile(FileStatus.LINKED);
    repository.findById.mockResolvedValue(file);
    storage.exists.mockResolvedValue(true);

    const result = await useCase.execute(new CompleteUploadCommand(file.id));

    expect(file.status).toBe(FileStatus.LINKED);
    expect(result.status).toBe(FileStatus.LINKED);
  });
});

function createFile(status: FileStatus): FileObject {
  return FileObject.create({
    id: 'media-file-1',
    storageKey: 'uploads/2026/06/media-file-1.png',
    originalName: 'avatar.png',
    mimeType: 'image/png',
    fileSize: 1024,
    bucketName: 'media',
    uploadedById: 'user-1',
    status,
  });
}
