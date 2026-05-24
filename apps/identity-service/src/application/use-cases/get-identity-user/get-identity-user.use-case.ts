import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { IdentityUserNotFoundException } from '../../../domain/exceptions/identity-user-not-found.exception';
import { IdentityUserRepository } from '../../../domain/repositories/identity-user.repository';
import { IdentityUserResult } from '../shared/identity-user.result';
import { toIdentityUserResult } from '../shared/identity-user-result.mapper';
import { GetIdentityUserQuery } from './get-identity-user.query';

@Injectable()
export class GetIdentityUserUseCase
  implements IUseCase<GetIdentityUserQuery, IdentityUserResult>
{
  constructor(
    private readonly identityUserRepository: IdentityUserRepository,
  ) {}

  async execute(query: GetIdentityUserQuery): Promise<IdentityUserResult> {
    const user = await this.identityUserRepository.findById(query.userId);
    if (!user) {
      throw new IdentityUserNotFoundException(query.userId);
    }
    return toIdentityUserResult(user);
  }
}
