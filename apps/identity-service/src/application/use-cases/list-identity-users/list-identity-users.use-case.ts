import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { IdentityUserRepository } from '../../../domain/repositories/identity-user.repository';
import { PaginatedIdentityUsersResult } from '../shared/identity-user.result';
import { toIdentityUserResult } from '../shared/identity-user-result.mapper';
import { ListIdentityUsersQuery } from './list-identity-users.query';

@Injectable()
export class ListIdentityUsersUseCase
  implements IUseCase<ListIdentityUsersQuery, PaginatedIdentityUsersResult>
{
  constructor(
    private readonly identityUserRepository: IdentityUserRepository,
  ) {}

  async execute(
    query: ListIdentityUsersQuery,
  ): Promise<PaginatedIdentityUsersResult> {
    const page = Math.max(query.page ?? 1, 1);
    const size = Math.min(Math.max(query.size ?? 20, 1), 100);
    const result = await this.identityUserRepository.list({
      page,
      size,
      role: query.role,
      isActive: query.isActive,
      includeDeleted: query.includeDeleted,
      search: query.search,
    });

    return new PaginatedIdentityUsersResult(
      result.items.map(toIdentityUserResult),
      result.total,
      page,
      size,
    );
  }
}
