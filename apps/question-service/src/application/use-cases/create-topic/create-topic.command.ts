export class CreateTopicCommand {
  constructor(
    readonly name: string,
    readonly description?: string | null,
    readonly parentId?: string | null,
  ) {}
}
