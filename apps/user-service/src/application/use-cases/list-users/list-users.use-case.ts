import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { UserProfileRepository } from '../../../domain/repositories/user-profile.repository';
import { GetUserProfileResult } from '../get-user-profile/get-user-profile.result';
import { ListUsersQuery } from './list-users.query';

export class ListUsersResult {
  constructor(
    readonly items: GetUserProfileResult[],
    readonly total: number,
    readonly page: number,
    readonly size: number,
  ) {}
}

@Injectable()
export class ListUsersUseCase
  implements IUseCase<ListUsersQuery, ListUsersResult>
{
  constructor(private readonly userProfileRepository: UserProfileRepository) {}

  async execute(query: ListUsersQuery): Promise<ListUsersResult> {
    const { items, total } = await this.userProfileRepository.list({
      role: query.role,
      isActive: query.isActive,
      search: query.search,
      page: query.page,
      size: query.size,
    });

    const results = items.map(
      (p) =>
        new GetUserProfileResult(
          p.id,
          p.fullName,
          p.email,
          p.phoneNumber,
          p.dateOfBirth,
          p.avatarUrl,
          p.gender,
          p.address,
          p.role,
          p.isActive,
          p.createdAt,
          p.studentDetail
            ? {
                licenseTier: p.studentDetail.licenseTier,
                enrolledAt: p.studentDetail.enrolledAt,
                notes: p.studentDetail.notes,
              }
            : null,
        ),
    );

    return new ListUsersResult(results, total, query.page, query.size);
  }
}
