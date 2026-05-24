import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../domain/aggregates/identity-user/identity-user.types';

export class ChangeRoleResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;
}
