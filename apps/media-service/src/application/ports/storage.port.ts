export abstract class StoragePort {
  abstract upload(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  abstract delete(key: string): Promise<void>;
  abstract exists(key: string): Promise<boolean>;
  abstract getPresignedUrl(key: string, expiresIn?: number): Promise<string>;
  abstract generateUploadSasUrl(
    key: string,
    mimeType: string,
    expiresIn?: number,
  ): Promise<{ uploadUrl: string; publicUrl: string }>;
}
