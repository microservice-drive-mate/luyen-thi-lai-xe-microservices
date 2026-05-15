export class DeleteTemplateCommand {
  constructor(
    readonly id: string,
    readonly expectedVersion: number,
  ) {}
}
