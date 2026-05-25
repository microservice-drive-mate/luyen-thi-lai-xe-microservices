import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import { StoragePort } from '../../application/ports/storage.port';
import { FileUploadFailedException } from '../../domain/exceptions/file-upload-failed.exception';

@Injectable()
export class AzureBlobStorageProvider
  extends StoragePort
  implements OnModuleInit
{
  private readonly client?: BlobServiceClient;
  private readonly containerName: string;
  private readonly accountName: string;
  private readonly credential?: StorageSharedKeyCredential;
  private readonly defaultPresignedUrlExpiry: number;
  private readonly logger = new Logger(AzureBlobStorageProvider.name);

  constructor(configService: ConfigService) {
    super();
    this.accountName = configService.get<string>('storage.accountName') ?? '';
    const accountKey = configService.get<string>('storage.accountKey') ?? '';
    this.containerName =
      configService.get<string>('storage.containerName') ?? 'media';
    this.defaultPresignedUrlExpiry =
      configService.get<number>('storage.presignedUrlExpiry') ?? 3600;

    if (!this.accountName || !accountKey) {
      this.logger.warn(
        'Azure Blob Storage is not configured; media upload endpoints are disabled',
      );
      return;
    }

    this.credential = new StorageSharedKeyCredential(
      this.accountName,
      accountKey,
    );
    this.client = new BlobServiceClient(
      `https://${this.accountName}.blob.core.windows.net`,
      this.credential,
    );
  }

  // Tự động tạo container nếu chưa tồn tại khi service khởi động
  async onModuleInit(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const containerClient = this.client.getContainerClient(
        this.containerName,
      );
      await containerClient.createIfNotExists();
      this.logger.log(
        `Azure Blob Storage ready — container: "${this.containerName}"`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Azure Blob Storage is not reachable during startup: ${message}`,
      );
    }
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    try {
      const blockBlobClient = this.getClient()
        .getContainerClient(this.containerName)
        .getBlockBlobClient(key);

      await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: { blobContentType: mimeType },
      });
      this.logger.log(`Uploaded blob: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to upload ${key}: ${(error as Error).message}`);
      throw new FileUploadFailedException(key);
    }
  }

  async delete(key: string): Promise<void> {
    await this.getClient()
      .getContainerClient(this.containerName)
      .getBlockBlobClient(key)
      .delete();
    this.logger.log(`Deleted blob: ${key}`);
  }

  async getPresignedUrl(key: string, expiresIn?: number): Promise<string> {
    const ttl = expiresIn ?? this.defaultPresignedUrlExpiry;
    const blockBlobClient = this.getClient()
      .getContainerClient(this.containerName)
      .getBlockBlobClient(key);

    const credential = this.getCredential();
    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName: key,
        permissions: BlobSASPermissions.parse('r'),
        expiresOn: new Date(Date.now() + ttl * 1000),
      },
      credential,
    ).toString();

    return `${blockBlobClient.url}?${sasToken}`;
  }

  async generateUploadSasUrl(
    key: string,
    mimeType: string,
    expiresIn?: number,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    const ttl = expiresIn ?? this.defaultPresignedUrlExpiry;
    const blockBlobClient = this.getClient()
      .getContainerClient(this.containerName)
      .getBlockBlobClient(key);

    const credential = this.getCredential();
    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName: key,
        permissions: BlobSASPermissions.parse('cw'),
        expiresOn: new Date(Date.now() + ttl * 1000),
        contentType: mimeType,
      },
      credential,
    ).toString();

    return {
      uploadUrl: `${blockBlobClient.url}?${sasToken}`,
      publicUrl: blockBlobClient.url,
    };
  }

  private getClient(): BlobServiceClient {
    if (!this.client) {
      throw new Error('Azure Blob Storage is not configured');
    }

    return this.client;
  }

  private getCredential(): StorageSharedKeyCredential {
    if (!this.credential) {
      throw new Error('Azure Blob Storage is not configured');
    }

    return this.credential;
  }
}
