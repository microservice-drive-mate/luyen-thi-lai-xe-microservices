import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../domain/aggregates/identity-user/identity-user.types';

export class CreateUserResponseDto {
  @ApiProperty({ description: 'UUID của người dùng trong Keycloak' })
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;
}
