export class UpdateTopicCommand {
  constructor(
    readonly topicId: string,
    readonly name?: string,
    readonly description?: string | null,
    readonly parentId?: string | null,
  ) {}
}
