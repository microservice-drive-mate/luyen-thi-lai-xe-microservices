export class DeleteFileCommand {
  constructor(
    readonly fileId: string,
    readonly deletedById: string,
  ) {}
}
