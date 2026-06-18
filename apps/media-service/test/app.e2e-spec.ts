import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiResponseInterceptor } from '@repo/common';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { CompleteUploadUseCase } from '../src/application/use-cases/complete-upload/complete-upload.use-case';
import { DeleteFileUseCase } from '../src/application/use-cases/delete-file/delete-file.use-case';
import { GetFileMetadataUseCase } from '../src/application/use-cases/get-file-metadata/get-file-metadata.use-case';
import { GetPresignedUrlUseCase } from '../src/application/use-cases/get-presigned-url/get-presigned-url.use-case';
import { InitiateUploadUseCase } from '../src/application/use-cases/initiate-upload/initiate-upload.use-case';
import { ListFilesUseCase } from '../src/application/use-cases/list-files/list-files.use-case';
import { UploadFileUseCase } from '../src/application/use-cases/upload-file/upload-file.use-case';
import { AdminMediaController } from '../src/presentation/http/admin-media.controller';
import { MediaController } from '../src/presentation/http/media.controller';

describe('Media service HTTP contract (e2e smoke)', () => {
  let app: INestApplication;

  const uploadFileUseCase = { execute: jest.fn() };
  const initiateUploadUseCase = { execute: jest.fn() };
  const completeUploadUseCase = { execute: jest.fn() };
  const getFileMetadataUseCase = { execute: jest.fn() };
  const getPresignedUrlUseCase = { execute: jest.fn() };
  const deleteFileUseCase = { execute: jest.fn() };
  const listFilesUseCase = { execute: jest.fn() };

  const now = new Date('2026-06-01T00:00:00.000Z');

  const fileObject = {
    id: 'file-1',
    storageKey: 'media/file-1/avatar.jpg',
    originalName: 'avatar.jpg',
    mimeType: 'image/jpeg',
    fileSize: 204800,
    bucketName: 'media',
    uploadedById: 'student-1',
    isPublic: false,
    status: 'UPLOADED',
    createdAt: now,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MediaController, AdminMediaController],
      providers: [
        { provide: UploadFileUseCase, useValue: uploadFileUseCase },
        { provide: InitiateUploadUseCase, useValue: initiateUploadUseCase },
        { provide: CompleteUploadUseCase, useValue: completeUploadUseCase },
        { provide: GetFileMetadataUseCase, useValue: getFileMetadataUseCase },
        { provide: GetPresignedUrlUseCase, useValue: getPresignedUrlUseCase },
        { provide: DeleteFileUseCase, useValue: deleteFileUseCase },
        { provide: ListFilesUseCase, useValue: listFilesUseCase },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(
      (
        req: Request & { user?: unknown },
        _res: Response,
        next: NextFunction,
      ) => {
        req.user = { sub: req.header('x-user-id') ?? 'student-1' };
        next();
      },
    );
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /media/files/init returns direct-upload URLs and mediaFileId', async () => {
    initiateUploadUseCase.execute.mockResolvedValue({
      mediaFileId: 'file-1',
      uploadUrl: 'https://storage.example.test/upload/file-1',
      publicUrl: 'https://storage.example.test/media/file-1/avatar.jpg',
      expiresAt: new Date('2026-06-01T00:15:00.000Z'),
    });

    await request(app.getHttpServer())
      .post('/media/files/init')
      .set('x-user-id', 'student-1')
      .send({
        originalName: 'avatar.jpg',
        mimeType: 'image/jpeg',
        fileSize: 204800,
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          mediaFileId: 'file-1',
          uploadUrl: 'https://storage.example.test/upload/file-1',
        });
      });
  });

  it('POST /media/files/:id/complete confirms uploaded metadata', async () => {
    completeUploadUseCase.execute.mockResolvedValue(fileObject);

    await request(app.getHttpServer())
      .post('/media/files/file-1/complete')
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          id: 'file-1',
          status: 'UPLOADED',
          originalName: 'avatar.jpg',
        });
      });
  });

  it('GET /media/files/:id/url returns a short-lived download URL', async () => {
    getPresignedUrlUseCase.execute.mockResolvedValue({
      url: 'https://storage.example.test/download/file-1',
      expiresAt: new Date('2026-06-01T00:15:00.000Z'),
    });

    await request(app.getHttpServer())
      .get('/media/files/file-1/url')
      .expect(200)
      .expect((response) => {
        expect(response.body.data.url).toContain('/download/file-1');
      });
  });

  it('GET /admin/media/files returns paginated media metadata', async () => {
    listFilesUseCase.execute.mockResolvedValue({
      items: [fileObject],
      total: 1,
      page: 1,
      size: 20,
    });

    await request(app.getHttpServer())
      .get('/admin/media/files')
      .expect(200)
      .expect((response) => {
        expect(response.body.data.items[0]).toMatchObject({
          id: 'file-1',
          mimeType: 'image/jpeg',
          uploadedById: 'student-1',
        });
      });
  });
});
