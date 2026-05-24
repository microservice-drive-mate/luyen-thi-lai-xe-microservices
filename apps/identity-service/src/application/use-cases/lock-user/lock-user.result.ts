export class LockUserResult {
  constructor(
    readonly userId: string,
    readonly locked: boolean,
  ) {}
}
