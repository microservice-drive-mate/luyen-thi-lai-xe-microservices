export class LockUserCommand {
  constructor(
    readonly targetUserId: string,
    readonly lock: boolean, // true = lock, false = unlock
  ) {}
}
