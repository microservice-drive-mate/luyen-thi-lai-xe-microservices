import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../types/user-role.enum';

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
