export class DeleteIdentityUserCommand {
  constructor(
    readonly userId: string,
    readonly deletedById: string | null,
  ) {}
}
