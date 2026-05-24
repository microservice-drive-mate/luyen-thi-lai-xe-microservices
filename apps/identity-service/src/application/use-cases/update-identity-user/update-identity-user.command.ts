export class UpdateIdentityUserCommand {
  constructor(
    readonly userId: string,
    readonly email?: string,
    readonly fullName?: string,
  ) {}
}
