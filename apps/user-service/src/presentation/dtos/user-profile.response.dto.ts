import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateUserProfileResult } from '../../application/use-cases/create-user-profile/create-user-profile.use-case';
import { GetUserProfileResult } from '../../application/use-cases/get-user-profile/get-user-profile.result';
import { ListUsersResult } from '../../application/use-cases/list-users/list-users.use-case';
import {
  Gender,
  LicenseTier,
  UserRole,
} from '../../domain/aggregates/user-profile/user-profile.types';

export class CreateUserProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  static fromResult(result: CreateUserProfileResult): CreateUserProfileResponseDto {
    const dto = new CreateUserProfileResponseDto();
    dto.id = result.id;
    dto.fullName = result.fullName;
    dto.email = result.email;
    dto.role = result.role;
    return dto;
  }
}

export class StudentDetailResponseDto {
  @ApiPropertyOptional({ enum: LicenseTier })
  licenseTier!: LicenseTier | null;

  @ApiPropertyOptional()
  enrolledAt!: Date | null;

  @ApiPropertyOptional()
  notes!: string | null;
}

export class UserProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  phoneNumber!: string | null;

  @ApiPropertyOptional()
  dateOfBirth!: Date | null;

  @ApiPropertyOptional()
  avatarUrl!: string | null;

  @ApiPropertyOptional({ enum: Gender })
  gender!: Gender | null;

  @ApiPropertyOptional()
  address!: string | null;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({ type: () => StudentDetailResponseDto })
  studentDetail!: StudentDetailResponseDto | null;

  static fromResult(result: GetUserProfileResult): UserProfileResponseDto {
    const dto = new UserProfileResponseDto();
    dto.id = result.id;
    dto.fullName = result.fullName;
    dto.email = result.email;
    dto.phoneNumber = result.phoneNumber;
    dto.dateOfBirth = result.dateOfBirth;
    dto.avatarUrl = result.avatarUrl;
    dto.gender = result.gender;
    dto.address = result.address;
    dto.role = result.role;
    dto.isActive = result.isActive;
    dto.createdAt = result.createdAt;
    dto.studentDetail = result.studentDetail;
    return dto;
  }
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ type: () => [UserProfileResponseDto] })
  items!: UserProfileResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  size!: number;

  static fromResult(result: ListUsersResult): PaginatedUsersResponseDto {
    const dto = new PaginatedUsersResponseDto();
    dto.items = result.items.map((item) =>
      UserProfileResponseDto.fromResult(item),
    );
    dto.total = result.total;
    dto.page = result.page;
    dto.size = result.size;
    return dto;
  }
}
