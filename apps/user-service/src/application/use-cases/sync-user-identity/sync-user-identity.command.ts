export class SyncUserIdentityCommand {
  constructor(
    readonly userId: string,
    readonly email: string,
    readonly fullName: string,
  ) {}
}
