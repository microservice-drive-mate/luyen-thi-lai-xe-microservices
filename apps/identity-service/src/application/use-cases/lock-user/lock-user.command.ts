export class LockUserCommand {
  constructor(
    readonly userId: string,
    readonly locked: boolean,
  ) {}
}
